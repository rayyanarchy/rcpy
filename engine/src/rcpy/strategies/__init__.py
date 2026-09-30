"""Parse strategies: different ways of turning one audio file into a ParseResult.

`parse_audio` is the entry point used by the CLI, the API and the evals. It
validates the file once, then hands off to the chosen strategy's `run`.
"""

import mimetypes
from collections.abc import Callable
from pathlib import Path

from rcpy.config import Settings
from rcpy.errors import RcpyError
from rcpy.schema import ParseResult
from rcpy.strategies import single, staged
from rcpy.strategies._gemini import Gemini
from rcpy.strategies.demo import DEMO
from rcpy.trace import Trace

Strategy = Callable[[Gemini, Path, str], ParseResult]

STRATEGIES: dict[str, Strategy] = {
    "single": single.run,
    "staged": staged.run,
    "staged-lite": staged.run_lite,
}

# The model calls each strategy makes, in order, so a client can show progress up front.
STAGES: dict[str, list[str]] = {
    "single": ["single"],
    "staged": ["transcribe", "extract", "verify"],
    "staged-lite": ["transcribe", "extract"],
}

# Gemini rejects some types, so map by extension ourselves instead of guessing.
AUDIO_MIME_TYPES = {
    ".mp3": "audio/mp3",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",  # Safari's browser recorder produces this
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
}


def guess_audio_mime(path: Path) -> str:
    mime = AUDIO_MIME_TYPES.get(path.suffix.lower())
    if mime:
        return mime
    guessed, _ = mimetypes.guess_type(path)
    if guessed and guessed.startswith("audio/"):
        return guessed
    supported = ", ".join(sorted(AUDIO_MIME_TYPES))
    raise RcpyError(f"{path.name}: unsupported audio type. Supported: {supported}")


def parse_audio(path: Path, settings: Settings, strategy: str | None = None, trace: Trace | None = None) -> ParseResult:
    name = strategy or settings.strategy
    run = STRATEGIES.get(name)
    if run is None:
        raise RcpyError(f"unknown strategy {name!r}. Choose from: {', '.join(STRATEGIES)}")
    if not path.is_file():
        raise RcpyError(f"{path}: file not found")
    mime = guess_audio_mime(path)
    size_mb = path.stat().st_size / (1024 * 1024)
    if size_mb > settings.max_audio_mb:
        raise RcpyError(f"{path.name}: {size_mb:.1f} MB exceeds the {settings.max_audio_mb:g} MB limit")

    if settings.demo_mode:
        if trace is not None:  # walk through the stages so progress UIs work without a key
            for stage in STAGES[name]:
                with trace.stage(stage, "demo"):
                    pass
        return DEMO.model_copy(deep=True)

    return run(Gemini(settings, path.name, trace), path, mime)
