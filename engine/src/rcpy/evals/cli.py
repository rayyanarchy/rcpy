"""`rcpy eval ...`: build the eval set, run strategies over it, compare runs."""

import re
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.table import Table

from rcpy.config import get_settings
from rcpy.errors import RcpyError
from rcpy.evals import runner
from rcpy.evals.gold import GoldCase, GoldIngredient, GoldRecipe, add_audio, list_cases, save_case
from rcpy.evals.scripts import load_scripts, match_recording
from rcpy.strategies import STRATEGIES, parse_audio

app = typer.Typer(help="Measure how accurately strategies turn audio into recipes.", no_args_is_help=True)
err = Console(stderr=True)
out = Console()

# (key, label, kind) in display order. kind: pct, num, int, sec, usd, tok
METRICS = [
    ("ingredient_f1", "Ingredient F1", "pct"),
    ("ingredient_precision", "  precision", "pct"),
    ("ingredient_recall", "  recall", "pct"),
    ("quantity_accuracy", "Quantity accuracy", "pct"),
    ("ingredient_exact", "Ingredient exact (end to end)", "pct"),
    ("step_recall", "Step coverage", "pct"),
    ("step_precision", "Step precision", "pct"),
    ("metadata_accuracy", "Servings/times accuracy", "pct"),
    ("metadata_invented", "Invented servings/times", "int"),
    ("uncertain_recall", "Errors flagged uncertain", "pct"),
    ("uncertain_precision", "Flags that were errors", "pct"),
    ("error_rate", "Failed parses", "pct"),
]
PERFORMANCE = [
    ("seconds_mean", "Latency (mean)", "sec"),
    ("seconds_p95", "Latency (p95)", "sec"),
    ("calls_per_recipe", "Model calls / recipe", "num"),
    ("input_tokens_mean", "Input tokens / recipe", "tok"),
    ("output_tokens_mean", "Output tokens / recipe", "tok"),
    ("cost_usd_mean", "Cost / recipe", "usd"),
]


def _fmt(value, kind: str, sd=None) -> str:
    if value is None:
        return "-"
    text = {
        "pct": lambda v: f"{v * 100:.1f}%",
        "num": lambda v: f"{v:.1f}",
        "int": lambda v: f"{v:g}",
        "sec": lambda v: f"{v:.1f}s",
        "usd": lambda v: f"${v:.4f}",
        "tok": lambda v: f"{v:,.0f}",
    }[kind](value)
    if sd is not None and kind == "pct":
        text += f" ±{sd * 100:.1f}"
    return text


def _fail(exc: Exception) -> None:
    err.print(f"[red]error:[/red] {exc}")
    raise typer.Exit(code=1)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "case"


@app.command()
def add(
    files: Annotated[list[Path], typer.Argument(help="Recording(s) to add as eval cases.")],
    bootstrap: Annotated[bool, typer.Option(help="Pre-fill gold.json from a model run, to correct by hand.")] = True,
    strategy: Annotated[str, typer.Option("-s", "--strategy", help="Strategy used to pre-fill.")] = "single",
    scripts_dir: Annotated[
        Path | None, typer.Option("--scripts", help="Dictation scripts folder (default: <EVALS_DIR>/scripts).")
    ] = None,
) -> None:
    """Add recordings as cases.

    A recording named after a dictation script (khatti-dal.m4a, or khatti-dal--mom.m4a)
    takes its answer key from the script and is ready to run. Any other recording gets a
    gold.json drafted by the model, to correct by hand and then mark reviewed.
    """
    settings = get_settings()
    scripts = load_scripts(scripts_dir or Path(settings.evals_dir) / "scripts")
    failures = 0
    for path in files:
        if not path.is_file():
            err.print(f"[red]error:[/red] {path}: file not found")
            failures += 1
            continue
        case_id = _slug(path.stem)
        try:
            case_dir = add_audio(settings.data_dir, path, case_id)
        except FileExistsError as exc:
            err.print(f"[yellow]skip:[/yellow] {exc}")
            continue
        script_id, speaker = match_recording(path.stem)
        if script_id in scripts:
            save_case(case_dir, scripts[script_id].to_case(case_id, speaker))
            err.print(f"[green]added[/green] {case_id} [dim](answer key from {script_id}.md)[/dim]")
            continue
        case = GoldCase(
            id=case_id,
            recipe=GoldRecipe(name="TODO", ingredients=[GoldIngredient(name="TODO", amount=None)], steps=["TODO"]),
        )
        if bootstrap:
            try:
                with err.status(f"Drafting {case_id}..."):
                    result = parse_audio(path, settings, strategy=strategy)
                case = GoldCase.from_prediction(case_id, result)
                (case_dir / "transcript.txt").write_text(
                    f"{result.original_transcript}\n\n---\n\n{result.recipe.english_transcript}\n", encoding="utf-8"
                )
            except RcpyError as exc:
                err.print(f"[yellow]warning:[/yellow] could not pre-fill {case_id}: {exc}")
        save_case(case_dir, case)
        err.print(f"[green]added[/green] {case_dir / 'gold.json'}")
    if failures:
        raise typer.Exit(code=1)


@app.command("scripts")
def scripts_(
    scripts_dir: Annotated[Path | None, typer.Option("--scripts", help="Default: <EVALS_DIR>/scripts.")] = None,
) -> None:
    """Show the dictation scripts, who reads each one, and which are recorded."""
    settings = get_settings()
    scripts = load_scripts(scripts_dir or Path(settings.evals_dir) / "scripts")
    recorded: dict[str, int] = {}
    for _, case in list_cases(settings.data_dir):
        if case.script:
            recorded[case.script] = recorded.get(case.script, 0) + 1
    table = Table("script", "reader", "language", "length", "recorded", "tags")
    for s in sorted(scripts.values(), key=lambda s: (s.speaker, s.id)):
        table.add_row(
            s.id, s.speaker, s.language, s.length.removeprefix("about "), str(recorded.get(s.id, "")), ", ".join(s.tags)
        )
    out.print(table)
    err.print(f"{sum(1 for s in scripts if s in recorded)}/{len(scripts)} scripts recorded", highlight=False)


@app.command("list")
def list_() -> None:
    """Show the eval cases and whether they have been reviewed."""
    cases = list_cases(get_settings().data_dir)
    if not cases:
        err.print("No cases yet. Add some with: rcpy eval add <audio files>")
        return
    table = Table("case", "reviewed", "language", "ingredients", "steps", "tags")
    for _, c in cases:
        table.add_row(
            c.id,
            "[green]yes[/green]" if c.reviewed else "[yellow]no[/yellow]",
            c.language,
            str(len(c.recipe.ingredients)),
            str(len(c.recipe.steps)),
            ", ".join(c.tags),
        )
    out.print(table)
    done = sum(c.reviewed for _, c in cases)
    err.print(f"{done}/{len(cases)} reviewed")


@app.command()
def run(
    strategy: Annotated[str, typer.Option("-s", "--strategy", help=f"One of: {', '.join(STRATEGIES)}")] = "single",
    cases: Annotated[str | None, typer.Option(help="Comma-separated case ids (default: all reviewed).")] = None,
    repeats: Annotated[int, typer.Option("-n", "--repeats", min=1, help="Runs per case, to measure variance.")] = 1,
    jobs: Annotated[int, typer.Option("-j", "--jobs", min=1, help="Parallel model calls.")] = 4,
    include_unreviewed: Annotated[bool, typer.Option(help="Also use gold files not yet reviewed.")] = False,
    show_cases: Annotated[bool, typer.Option("--show-cases", help="Print per-case errors.")] = False,
) -> None:
    """Run a strategy over the eval set and print its scores."""
    settings = get_settings()
    if strategy not in STRATEGIES:
        _fail(RcpyError(f"unknown strategy {strategy!r}. Choose from: {', '.join(STRATEGIES)}"))
    try:
        selected = runner.select_cases(settings, cases.split(",") if cases else None, include_unreviewed)
    except RcpyError as exc:
        _fail(exc)
    total = len(selected) * repeats
    done = 0

    def progress(case_id: str, rep: int, error: str | None) -> None:
        nonlocal done
        done += 1
        mark = "[red]failed[/red]" if error else "[green]ok[/green]"
        err.print(f"[dim]{done}/{total}[/dim] {case_id}{f' #{rep + 1}' if repeats > 1 else ''} {mark}")

    err.print(f"Running [bold]{strategy}[/bold] on {len(selected)} case(s) x {repeats}")
    summary = runner.run(settings, strategy, selected, repeats=repeats, jobs=jobs, on_done=progress)
    _print_summaries([summary])
    if show_cases:
        _print_cases(summary)
    err.print(f"[dim]saved {runner.results_dir(settings) / (summary['run_id'] + '.json')}[/dim]")


@app.command()
def rescore(run_id: Annotated[str, typer.Argument(help="Run id from a previous `rcpy eval run`.")]) -> None:
    """Re-grade a cached run against the current gold files (no model calls)."""
    try:
        summary = runner.rescore(get_settings(), run_id)
    except RcpyError as exc:
        _fail(exc)
    _print_summaries([summary])


@app.command()
def compare(
    run_ids: Annotated[list[str] | None, typer.Argument(help="Run ids (default: every saved summary).")] = None,
    markdown: Annotated[bool, typer.Option("--markdown", help="Print a Markdown table to stdout.")] = False,
) -> None:
    """Show several runs side by side."""
    try:
        summaries = runner.load_summaries(get_settings(), run_ids)
    except RcpyError as exc:
        _fail(exc)
    if not summaries:
        _fail(RcpyError("no saved runs yet. Start one with: rcpy eval run"))
    if markdown:
        typer.echo(_markdown(summaries))
    else:
        _print_summaries(summaries)


def _rows(summaries: list[dict]):
    for key, label, kind in METRICS:
        yield label, [_fmt(s["metrics"].get(key), kind, s["spread"].get(key)) for s in summaries]
    for key, label, kind in PERFORMANCE:
        yield label, [_fmt(s["performance"].get(key), kind) for s in summaries]


def _header(s: dict) -> str:
    return f"{s['strategy']} · {s['model']}\n{s['run_id']}\n{len(s['cases'])} cases × {s['repeats']}"


def _print_summaries(summaries: list[dict]) -> None:
    table = Table("metric", *(_header(s) for s in summaries))
    for label, values in _rows(summaries):
        table.add_row(label, *values)
    out.print(table)


def _print_cases(summary: dict) -> None:
    for c in summary["per_case"]:
        if c["error"]:
            out.print(f"[bold]{c['case_id']}[/bold] [red]{c['error']}[/red]")
            continue
        problems = (
            [f"missing: {m}" for m in c["missing"]]
            + [f"extra: {e}" for e in c["extra"]]
            + [f"quantity: {q}" for q in c["wrong_quantity"]]
        )
        if problems:
            out.print(f"[bold]{c['case_id']}[/bold]")
            for p in problems:
                out.print(f"  {p}")


def _markdown(summaries: list[dict]) -> str:
    head = [f"{s['strategy']} ({s['model']})" for s in summaries]
    lines = ["| Metric | " + " | ".join(head) + " |", "| --- |" + " --- |" * len(summaries)]
    lines += [f"| {label.strip()} | " + " | ".join(values) + " |" for label, values in _rows(summaries)]
    return "\n".join(lines)
