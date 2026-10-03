"""Run a strategy over the eval cases, cache every prediction, and write a summary.

Predictions are cached per run so `rescore` can re-grade them after a metric
change without paying for (or waiting on) the model again.
"""

import json
import statistics
import subprocess
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

from rcpy.config import Settings
from rcpy.errors import RcpyError
from rcpy.evals.gold import GoldCase, audio_path, list_cases
from rcpy.evals.metrics import CaseScore, case_dict, score_case, spread, summarize
from rcpy.schema import ParseResult
from rcpy.strategies import parse_audio
from rcpy.trace import Trace


def runs_dir(settings: Settings) -> Path:
    return Path(settings.data_dir) / "evals" / "runs"


def results_dir(settings: Settings) -> Path:
    return Path(settings.evals_dir) / "results"


def load_pricing(settings: Settings) -> dict[str, dict[str, float]]:
    path = Path(settings.evals_dir) / "pricing.json"
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not k.startswith("_")}


def _git_sha() -> str | None:
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True)
        dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return sha.stdout.strip() + ("-dirty" if dirty.stdout.strip() else "")


def select_cases(settings: Settings, ids: list[str] | None, include_unreviewed: bool) -> list[tuple[Path, GoldCase]]:
    cases = list_cases(settings.data_dir)
    if ids:
        known = {c.id for _, c in cases}
        unknown = [i for i in ids if i not in known]
        if unknown:
            raise RcpyError(f"unknown case(s): {', '.join(unknown)}")
        return [(d, c) for d, c in cases if c.id in ids]
    selected = [(d, c) for d, c in cases if c.reviewed or include_unreviewed]
    if not selected:
        hint = " (none are reviewed yet; pass --include-unreviewed to use drafts)" if cases else ""
        raise RcpyError(f"no eval cases to run{hint}")
    return selected


OnDone = Callable[[str, int, str | None], None]


def _predict_all(
    settings: Settings,
    strategy: str,
    out: Path,
    work: list[tuple[Path, GoldCase, int]],
    jobs: int,
    on_done: OnDone | None,
) -> None:
    """Run each (case, repeat) and write its record to `out`, overwriting any earlier one."""

    def one(item: tuple[Path, GoldCase, int]) -> None:
        case_dir, case, rep = item
        trace, pred, error = Trace(), None, None
        try:
            audio = audio_path(case_dir)
            if audio is None:
                raise RcpyError(f"{case.id}: no audio file in {case_dir}")
            pred = parse_audio(audio, settings, strategy=strategy, trace=trace)
        except RcpyError as exc:
            error = str(exc)
        record = {
            "case_id": case.id,
            "repeat": rep,
            "prediction": pred.model_dump(mode="json") if pred else None,
            "error": error,
            "trace": trace.to_dict(),
        }
        (out / f"{case.id}.{rep}.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
        if on_done:
            on_done(case.id, rep, error)

    with ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        list(pool.map(one, work))


def run(
    settings: Settings,
    strategy: str,
    cases: list[tuple[Path, GoldCase]],
    repeats: int = 1,
    jobs: int = 4,
    on_done: OnDone | None = None,
) -> dict:
    run_id = f"{datetime.now():%Y%m%d-%H%M%S}-{strategy}"
    out = runs_dir(settings) / run_id
    out.mkdir(parents=True)
    meta = {
        "run_id": run_id,
        "strategy": strategy,
        "model": settings.gemini_model,
        "demo_mode": settings.demo_mode,
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "git": _git_sha(),
        "repeats": repeats,
    }
    # Written first so an interrupted run can be resumed.
    (out / "run.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    _predict_all(settings, strategy, out, [(d, c, rep) for rep in range(repeats) for d, c in cases], jobs, on_done)
    return rescore(settings, run_id)


def failed_predictions(settings: Settings, run_id: str) -> list[tuple[Path, GoldCase, int]]:
    """The (case, repeat) pairs of a cached run that errored or never finished."""
    out = runs_dir(settings) / run_id
    if not (out / "run.json").is_file():
        raise RcpyError(f"no cached run {run_id!r} in {out.parent}")
    meta = json.loads((out / "run.json").read_text(encoding="utf-8"))
    todo = []
    for case_dir, case in list_cases(settings.data_dir):
        for rep in range(meta["repeats"]):
            path = out / f"{case.id}.{rep}.json"
            if not path.is_file() or json.loads(path.read_text(encoding="utf-8"))["error"]:
                todo.append((case_dir, case, rep))
    return todo


def resume(settings: Settings, run_id: str, jobs: int = 1, on_done: OnDone | None = None) -> dict:
    """Redo only the predictions that failed (e.g. on a rate limit), then rescore."""
    meta = json.loads((runs_dir(settings) / run_id / "run.json").read_text(encoding="utf-8"))
    todo = failed_predictions(settings, run_id)
    _predict_all(settings, meta["strategy"], runs_dir(settings) / run_id, todo, jobs, on_done)
    return rescore(settings, run_id)


def rescore(settings: Settings, run_id: str) -> dict:
    """Grade a cached run against the current gold files and write its summary."""
    out = runs_dir(settings) / run_id
    if not (out / "run.json").is_file():
        raise RcpyError(f"no cached run {run_id!r} in {out.parent}")
    meta = json.loads((out / "run.json").read_text(encoding="utf-8"))
    gold = {c.id: c for _, c in list_cases(settings.data_dir)}
    pricing = load_pricing(settings)

    rows: list[tuple[int, CaseScore, Trace, GoldCase]] = []
    for path in sorted(out.glob("*.*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        case = gold.get(record["case_id"])
        if case is None:
            continue  # case was deleted since the run
        pred = ParseResult.model_validate(record["prediction"]).recipe if record["prediction"] else None
        score = score_case(case.id, case.recipe, pred, record["error"])
        rows.append((record["repeat"], score, Trace.from_dict(record["trace"]), case))
    if not rows:
        raise RcpyError(f"run {run_id!r} has no predictions for current cases")

    scores = [s for _, s, _, _ in rows]
    per_repeat = [summarize([s for r, s, _, _ in rows if r == rep]) for rep in range(meta["repeats"])]
    tags = sorted({t for _, _, _, c in rows for t in c.tags})

    ok_traces = [t for _, s, t, _ in rows if s.error is None and t.stages]
    seconds = sorted(t.seconds for t in ok_traces)
    costs = [t.cost_usd(pricing) for t in ok_traces]

    def mean(values):
        return statistics.fmean(values) if values else None

    summary = {
        **meta,
        "cases": sorted({s.case_id for s in scores}),
        "predictions": len(scores),
        "metrics": summarize(scores),
        "spread": spread(per_repeat),
        "by_tag": {tag: summarize([s for _, s, _, c in rows if tag in c.tags]) for tag in tags},
        "performance": {
            "seconds_mean": mean(seconds),
            "seconds_p50": statistics.median(seconds) if seconds else None,
            "seconds_p95": seconds[min(len(seconds) - 1, int(0.95 * len(seconds)))] if seconds else None,
            "calls_per_recipe": mean([len(t.stages) for t in ok_traces]),
            "input_tokens_mean": mean([t.input_tokens for t in ok_traces]),
            "output_tokens_mean": mean([t.output_tokens for t in ok_traces]),
            "cost_usd_mean": mean(costs) if costs and None not in costs else None,
        },
        "per_case": [
            {**case_dict(s), "repeat": r, "seconds": t.seconds, "cost_usd": t.cost_usd(pricing)}
            for r, s, t, _ in sorted(rows, key=lambda row: (row[1].case_id, row[0]))
        ],
    }
    results = results_dir(settings)
    results.mkdir(parents=True, exist_ok=True)
    (results / f"{run_id}.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def load_summaries(settings: Settings, run_ids: list[str] | None = None) -> list[dict]:
    results = results_dir(settings)
    paths = [results / f"{r}.json" for r in run_ids] if run_ids else sorted(results.glob("*.json"))
    missing = [p.stem for p in paths if not p.is_file()]
    if missing:
        raise RcpyError(f"no summary for run(s): {', '.join(missing)}")
    return [json.loads(p.read_text(encoding="utf-8")) for p in paths]
