import json

from typer.testing import CliRunner

from rcpy.cli import app

runner = CliRunner()


def test_parse_stdout_json(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    audio = tmp_path / "dal.m4a"
    audio.write_bytes(b"fake")
    res = runner.invoke(app, ["parse", str(audio)])
    assert res.exit_code == 0
    assert json.loads(res.stdout)["recipe"]["name"] == "Aloo Gobi"


def test_parse_batch_writes_files(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    a, b = tmp_path / "a.mp3", tmp_path / "b.wav"
    a.write_bytes(b"x")
    b.write_bytes(b"x")
    out = tmp_path / "out"
    res = runner.invoke(app, ["parse", str(a), str(b), "-f", "json,md,html", "-o", str(out)])
    assert res.exit_code == 0
    assert sorted(p.name for p in out.iterdir()) == [
        "a.html", "a.json", "a.md", "b.html", "b.json", "b.md",
    ]


def test_bad_extension_and_missing_key(tmp_path, monkeypatch):
    monkeypatch.delenv("DEMO_MODE", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "")
    txt = tmp_path / "notes.txt"
    txt.write_text("hi")
    res = runner.invoke(app, ["parse", str(txt)])
    assert res.exit_code == 1
    assert "unsupported audio type" in res.output


def test_bad_format(tmp_path):
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"x")
    res = runner.invoke(app, ["parse", str(audio), "-f", "pdf"])
    assert res.exit_code != 0
