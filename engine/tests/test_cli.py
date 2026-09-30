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
        "a.html",
        "a.json",
        "a.md",
        "b.html",
        "b.json",
        "b.md",
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


def test_share_prints_link(tmp_path, monkeypatch):
    from rcpy import cli
    from rcpy.share import ShareLinks

    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setattr(
        cli, "share_recipe", lambda result, url: ShareLinks("https://rcpy.example/r/abc12345", "c", "m")
    )
    audio = tmp_path / "dal.m4a"
    audio.write_bytes(b"x")
    out = tmp_path / "out"
    res = runner.invoke(app, ["parse", str(audio), "--share", "-o", str(out)])
    assert res.exit_code == 0
    assert "https://rcpy.example/r/abc12345" in res.output
    assert (out / "dal.json").exists()


def test_share_failure_sets_exit_code(tmp_path, monkeypatch):
    from rcpy import cli
    from rcpy.errors import RcpyError

    def boom(result, url):
        raise RcpyError("could not reach server")

    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setattr(cli, "share_recipe", boom)
    audio = tmp_path / "dal.m4a"
    audio.write_bytes(b"x")
    res = runner.invoke(app, ["parse", str(audio), "--share"])
    assert res.exit_code == 1
    assert "could not reach server" in res.output


def test_gemini_network_failure_is_a_clean_error(tmp_path, monkeypatch):
    import httpx
    from google import genai

    def boom(self, *args, **kwargs):
        raise httpx.ConnectError("no network")

    monkeypatch.delenv("DEMO_MODE", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(genai.files.Files, "upload", boom)
    audio = tmp_path / "dal.mp3"
    audio.write_bytes(b"x")
    res = runner.invoke(app, ["parse", str(audio)])
    assert res.exit_code == 1
    assert "could not reach Gemini" in res.output
    assert "Traceback" not in res.output


def test_default_output_dir_is_data_out(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    a, b = tmp_path / "a.mp3", tmp_path / "b.mp3"
    a.write_bytes(b"x")
    b.write_bytes(b"x")
    res = runner.invoke(app, ["parse", str(a), str(b)])  # two files, no -o
    assert res.exit_code == 0
    assert sorted(p.name for p in (tmp_path / "data" / "out").iterdir()) == ["a.json", "b.json"]


def test_unknown_strategy_is_a_clean_error(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    audio = tmp_path / "a.mp3"
    audio.write_bytes(b"x")
    res = runner.invoke(app, ["parse", str(audio), "-s", "nope"])
    assert res.exit_code == 1
    assert "unknown strategy" in res.output
