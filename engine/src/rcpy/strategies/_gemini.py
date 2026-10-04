"""Shared Gemini plumbing for the strategies: upload, generate, validate, clean up.

Every call goes through `Gemini.generate`, which times it into the trace and
turns SDK/network failures into user-safe `RcpyError`s.
"""

import logging
import re
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager, suppress
from pathlib import Path

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

from rcpy.config import Settings
from rcpy.errors import RcpyError
from rcpy.trace import Trace


class _DropAfcNotice(logging.Filter):
    """The SDK logs a scary-looking notice about "automatic function calling" on
    every call, even though we don't use function calling. Hide just that line."""

    def filter(self, record: logging.LogRecord) -> bool:
        return "automatic function calling" not in record.getMessage().lower()


logging.getLogger("google_genai.models").addFilter(_DropAfcNotice())

# Rate limits (429) and overload (503) are retried, waiting as long as Gemini asks.
# A wait longer than MAX_WAIT means a daily quota, which retrying won't fix.
RETRY_STATUS = {429, 503}
MAX_ATTEMPTS = 6
MAX_WAIT = 90.0


_STATUS = {429: 429, 503: 503}


def user_message(exc: genai_errors.APIError) -> str:
    if exc.code == 429:
        return "RCPY is getting more requests than it can handle right now. Please try again in a few minutes."
    if exc.code in (500, 503, 504):
        return "The AI service is overloaded right now. Please try again in a minute."
    return f"The AI service couldn't read this recording (error {exc.code}). Please try again."


def retry_delay(exc: genai_errors.APIError, attempt: int) -> float | None:
    """Seconds to wait before trying again, or None to give up."""
    if exc.code not in RETRY_STATUS or attempt >= MAX_ATTEMPTS:
        return None
    hint = re.search(r"retry in ((?:[\d.]+[hms])+)", str(exc.message or ""))
    if hint:  # "15.5s", or "9h10m57.2s" for a daily quota
        units = {"h": 3600, "m": 60, "s": 1}
        delay = sum(float(n) * units[u] for n, u in re.findall(r"([\d.]+)([hms])", hint.group(1))) + 1
    else:
        delay = min(MAX_WAIT, 2.0**attempt)
    return delay if delay <= MAX_WAIT else None


class Gemini:
    def __init__(self, settings: Settings, label: str, trace: Trace | None = None):
        if not settings.gemini_api_key:
            raise RcpyError(
                "GEMINI_API_KEY is not set. Add it to .env (or set DEMO_MODE=true to try the CLI).",
                status=503,
            )
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.settings = settings
        self.label = label  # file name, prefixed to error messages
        self.trace = trace if trace is not None else Trace()

    def _with_retries[T](self, call: Callable[[], T]) -> T:
        attempt = 0
        while True:
            attempt += 1
            try:
                return call()
            except genai_errors.APIError as exc:
                delay = retry_delay(exc, attempt)
                if delay is None:
                    raise
                logging.getLogger("rcpy").info("%s: Gemini %s, retrying in %.0fs", self.label, exc.code, delay)
                time.sleep(delay)

    @contextmanager
    def _errors(self) -> Iterator[None]:
        try:
            yield
        except genai_errors.APIError as exc:
            # The raw Gemini text (quota metrics, links) is for logs, not for people.
            logging.getLogger("rcpy").warning("%s: Gemini API error %s: %s", self.label, exc.code, exc.message)
            raise RcpyError(user_message(exc), status=_STATUS.get(exc.code, 502)) from exc
        except httpx.HTTPError as exc:
            raise RcpyError("Couldn't reach the AI service. Please try again in a moment.", status=502) from exc

    @contextmanager
    def upload(self, path: Path, mime: str) -> Iterator[types.File]:
        """Upload audio for the duration of the block, then delete it from Google's side."""
        uploaded = None
        try:
            with self._errors():
                uploaded = self._with_retries(
                    lambda: self.client.files.upload(file=path, config=types.UploadFileConfig(mime_type=mime))
                )
            yield uploaded
        finally:
            if uploaded is not None and uploaded.name:
                with suppress(Exception):  # cleanup is best-effort
                    self.client.files.delete(name=uploaded.name)

    def generate[M: BaseModel](self, stage: str, contents: list, schema: type[M], model: str | None = None) -> M:
        """One structured call: `contents` in, a validated `schema` instance out."""
        model = model or self.settings.gemini_model

        def call():
            with self.trace.stage(stage, model) as record:
                response = self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=schema,
                    ),
                )
                record.record_usage(response.usage_metadata)
            return response

        with self._errors():
            response = self._with_retries(call)
        try:
            return schema.model_validate_json(response.text or "")
        except ValidationError as exc:
            raise RcpyError(
                f"{self.label}: the recipe could not be structured. Try a clearer recording.",
                status=422,
            ) from exc
