from contextlib import contextmanager

from rcpy.strategies import staged
from rcpy.strategies.staged import RecipeBody, Transcript


class FakeGemini:
    """Stands in for the Gemini wrapper: returns canned output per stage, records the calls."""

    def __init__(self, result):
        from rcpy.trace import Trace

        self.events = []
        self.trace = Trace(listener=self.events.append)
        r = result.recipe
        self.transcript = Transcript(
            source_language=r.source_language,
            original_transcript=result.original_transcript,
            english_transcript=r.english_transcript,
        )
        self.body = RecipeBody(**r.model_dump(exclude={"source_language", "english_transcript"}))
        self.calls = []

    @contextmanager
    def upload(self, path, mime):
        yield "audio-handle"

    def generate(self, stage, contents, schema):
        self.calls.append((stage, contents))
        if stage == "transcribe":
            assert "audio-handle" in contents
            return self.transcript
        if stage == "verify":
            return self.body.model_copy(update={"name": "Verified"})
        return self.body


def test_staged_runs_three_stages_and_assembles(result, tmp_path):
    fake = FakeGemini(result)
    out = staged.run(fake, tmp_path / "a.mp3", "audio/mp3")
    assert [stage for stage, _ in fake.calls] == ["transcribe", "extract", "verify"]
    # Only the first stage sees audio; later stages get the transcript text.
    assert all("audio-handle" not in contents for _, contents in fake.calls[1:])
    assert result.recipe.english_transcript in fake.calls[1][1][1]
    assert out.recipe.name == "Verified"
    assert fake.events[0]["event"] == "transcript"
    assert fake.events[0]["englishTranscript"] == result.recipe.english_transcript
    assert out.original_transcript == result.original_transcript


def test_staged_lite_skips_verify(result, tmp_path):
    fake = FakeGemini(result)
    out = staged.run_lite(fake, tmp_path / "a.mp3", "audio/mp3")
    assert [stage for stage, _ in fake.calls] == ["transcribe", "extract"]
    assert out.recipe == result.recipe
