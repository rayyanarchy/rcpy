"""Command line interface: `rcpy parse <files...>`."""

from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console

from rcpy import __version__
from rcpy.config import get_settings
from rcpy.errors import RcpyError
from rcpy.formatters import FORMATS, render
from rcpy.share import share_recipe
from rcpy.strategies.single import parse_audio

app = typer.Typer(help="Turn dictated recipe audio into structured recipes.", no_args_is_help=True)
err = Console(stderr=True)  # progress and errors go to stderr so stdout stays pipe-friendly


def _version(value: bool) -> None:
    if value:
        typer.echo(f"rcpy {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: Annotated[bool, typer.Option("--version", callback=_version, is_eager=True)] = False,
) -> None:
    pass


def _parse_formats(value: str) -> list[str]:
    formats = [f.strip().lower() for f in value.split(",") if f.strip()]
    bad = [f for f in formats if f not in FORMATS]
    if bad or not formats:
        raise typer.BadParameter(f"choose from: {', '.join(FORMATS)}")
    return list(dict.fromkeys(formats))  # de-duplicate, keep order


@app.command()
def parse(
    files: Annotated[list[Path], typer.Argument(help="Audio file(s) to parse.")],
    formats: Annotated[str, typer.Option("-f", "--format", help="Comma-separated: json,md,html")] = "json",
    out: Annotated[
        Path | None,
        typer.Option(
            "-o", "--out",
            help="Output directory. Without it, one file + one format prints to stdout; otherwise files go to <DATA_DIR>/out.",
        ),
    ] = None,
    share: Annotated[
        bool, typer.Option("--share", help="Publish to the share server and print the link (expires in 1h).")
    ] = False,
) -> None:
    """Parse audio recipe(s) into json / md / html."""
    fmts = _parse_formats(formats)
    settings = get_settings()
    to_stdout = out is None and len(files) == 1 and len(fmts) == 1
    if out is None and not to_stdout:
        out = Path(settings.data_dir) / "out"
    if out is not None:
        out.mkdir(parents=True, exist_ok=True)

    failures = 0
    for path in files:
        try:
            with err.status(f"Parsing {path.name}..."):
                result = parse_audio(path, settings)
        except RcpyError as exc:
            err.print(f"[red]error:[/red] {exc}")
            failures += 1
            continue

        if to_stdout:
            typer.echo(render(result, fmts[0]), nl=False)
        else:
            for fmt in fmts:
                target = out / f"{path.stem}.{fmt}"
                target.write_text(render(result, fmt), encoding="utf-8")
                err.print(f"[green]wrote[/green] {target}")

        if share:
            try:
                with err.status("Sharing..."):
                    links = share_recipe(result, settings.share_url)
            except RcpyError as exc:
                err.print(f"[red]error:[/red] {exc}")
                failures += 1
                continue
            err.print(f"[bold]{links.url}[/bold] [dim](expires in 1 hour)[/dim]")

    if failures:
        raise typer.Exit(code=1)


@app.command()
def serve(
    host: Annotated[str, typer.Option(help="Interface to listen on.")] = "127.0.0.1",
    port: Annotated[int, typer.Option(help="Port to listen on.")] = 3000,
    reload: Annotated[bool, typer.Option(help="Restart on code changes (development).")] = False,
) -> None:
    """Run the web API (and the built web app, if web/dist exists)."""
    try:
        import fastapi  # noqa: F401
        import uvicorn
    except ImportError:
        err.print("[red]error:[/red] the API needs extra packages. Run: uv sync --all-extras")
        raise typer.Exit(code=1)
    uvicorn.run("rcpy.api:create_app", factory=True, host=host, port=port, reload=reload)
