from google.genai import errors as genai_errors

from rcpy.strategies import _gemini
from rcpy.strategies._gemini import retry_delay


def _error(code: int, message: str) -> genai_errors.APIError:
    return genai_errors.APIError(code, {"error": {"code": code, "message": message, "status": "X"}})


def test_retry_delay_follows_geminis_hint_and_gives_up_on_long_waits():
    assert retry_delay(_error(429, "Quota exceeded. Please retry in 15.58s."), 1) == 16.58
    assert retry_delay(_error(503, "overloaded"), 2) == 4.0
    assert retry_delay(_error(429, "Please retry in 3600s."), 1) is None  # a daily quota: don't wait
    assert retry_delay(_error(429, "Please retry in 9h10m57.29s."), 1) is None
    assert retry_delay(_error(429, "Please retry in 1m5s."), 1) == 66.0
    assert retry_delay(_error(400, "bad request"), 1) is None
    assert retry_delay(_error(429, "Please retry in 1s."), _gemini.MAX_ATTEMPTS) is None


def test_rate_limited_calls_are_retried(monkeypatch):
    monkeypatch.setattr(_gemini.time, "sleep", lambda s: None)
    gemini = object.__new__(_gemini.Gemini)
    gemini.label = "a.mp3"
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) < 3:
            raise _error(429, "Please retry in 1s.")
        return "ok"

    assert gemini._with_retries(flaky) == "ok"
    assert len(calls) == 3
