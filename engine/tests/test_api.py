import json
import re

import pytest
from fastapi.testclient import TestClient

from rcpy.api import create_app
from rcpy.config import Settings


@pytest.fixture
def data_dir(tmp_path):
    return tmp_path / "data"


@pytest.fixture
def client(data_dir):
    settings = Settings(demo_mode=True, data_dir=str(data_dir), public_base_url="https://rcpy.example", _env_file=None)
    return TestClient(create_app(settings))


def upload(client, name="recipe.webm"):
    return client.post("/api/process", files={"audio": (name, b"demo", "audio/webm")})


def publish(client):
    draft = upload(client).json()["draft"]
    res = client.post("/api/recipes", json=draft)
    assert res.status_code == 201
    return res.json()


def test_health(client):
    assert client.get("/health").json() == {"ok": True}


def test_process_returns_editable_camelcase_draft(client):
    res = upload(client)
    assert res.status_code == 200
    draft = res.json()["draft"]
    assert draft["sourceLanguage"] == "Hindi"
    assert draft["name"] == "Aloo Gobi"
    assert draft["servings"] == 4
    assert len(draft["ingredients"]) == 6
    assert re.fullmatch(r"[0-9a-f-]{36}", draft["ingredients"][0]["id"])


def test_publish_page_and_downloads(client):
    body = publish(client)
    assert body["url"].startswith("https://rcpy.example/r/")
    slug = body["recipe"]["slug"]

    page = client.get(f"/r/{slug}")
    assert page.status_code == 200
    assert '"@type":"Recipe"' in page.text
    assert "<h1>Aloo Gobi</h1>" in page.text

    crumb = json.loads(client.get(f"/api/recipes/{slug}/crumb").text)
    assert crumb["name"] == "Aloo Gobi"
    assert len(crumb["ingredients"]) == 6

    md = client.get(f"/api/recipes/{slug}/md")
    assert md.headers["content-disposition"].endswith('Aloo-Gobi.md"')
    assert md.text.startswith("# Aloo Gobi")
    assert f"https://rcpy.example/r/{slug}" in md.text


def test_get_and_update(client):
    body = publish(client)
    slug = body["recipe"]["slug"]
    assert client.get(f"/api/recipes/{slug}").json()["recipe"]["name"] == "Aloo Gobi"

    edited = {**body["recipe"], "name": "Better Aloo Gobi"}
    res = client.put(f"/api/recipes/{slug}", json=edited)
    assert res.status_code == 200
    assert res.json()["recipe"]["name"] == "Better Aloo Gobi"
    # editing keeps the original expiry
    assert res.json()["recipe"]["expiresAt"] == body["recipe"]["expiresAt"]
    assert client.put("/api/recipes/nope12345678", json=edited).status_code == 404


def test_expired_recipes_404_and_are_deleted(client, data_dir):
    slug = publish(client)["recipe"]["slug"]
    path = data_dir / "recipes" / f"{slug}.json"
    saved = json.loads(path.read_text())
    saved["expiresAt"] = "2020-01-01T00:00:00Z"
    path.write_text(json.dumps(saved))

    assert client.get(f"/r/{slug}").status_code == 404
    assert not path.exists()


def test_rejects_bad_uploads(client):
    res = upload(client, "recipe.txt")
    assert res.status_code == 400
    assert "MP3" in res.json()["error"]

    res = client.post("/api/process")
    assert res.status_code == 400
    assert res.json()["error"] == "Choose an audio file first."


def test_rejects_incomplete_recipe(client):
    res = client.post("/api/recipes", json={"name": ""})
    assert res.status_code == 400
    assert "incomplete" in res.json()["error"]

    draft = upload(client).json()["draft"]
    draft["servings"] = 0
    assert client.post("/api/recipes", json=draft).status_code == 400


def test_upload_size_limit(data_dir):
    settings = Settings(demo_mode=True, data_dir=str(data_dir), max_audio_mb=0.000001, _env_file=None)
    client = TestClient(create_app(settings))
    res = upload(client)
    assert res.status_code == 400
    assert "smaller" in res.json()["error"]


def test_unknown_and_malicious_slugs(client):
    assert client.get("/api/recipes/does-not-exist").status_code == 404
    assert client.get("/api/recipes/..%2F..%2Fetc").status_code == 404
    assert client.get("/r/short").status_code == 404


def test_process_is_rate_limited(client):
    codes = [upload(client).status_code for _ in range(11)]
    assert codes[:10] == [200] * 10
    assert codes[10] == 429


def _stream(client):
    res = client.post("/api/process?stream=true", files={"audio": ("r.webm", b"demo", "audio/webm")})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    return [json.loads(line) for line in res.text.splitlines()]


def test_process_stream_reports_each_stage_then_the_draft(data_dir):
    settings = Settings(demo_mode=True, strategy="staged", data_dir=str(data_dir), _env_file=None)
    events = _stream(TestClient(create_app(settings)))
    assert events[0] == {"event": "plan", "stages": ["transcribe", "extract", "verify"]}
    stages = [(e["name"], e["status"]) for e in events if e["event"] == "stage"]
    assert stages == [
        ("transcribe", "start"), ("transcribe", "done"),
        ("extract", "start"), ("extract", "done"),
        ("verify", "start"), ("verify", "done"),
    ]  # fmt: skip
    transcript = next(e for e in events if e["event"] == "transcript")
    assert events.index(transcript) == 3  # right after transcribe finishes, before extract starts
    assert transcript["englishTranscript"].startswith("Heat two tablespoons")
    assert events[-1]["event"] == "draft"
    assert events[-1]["draft"]["name"] == "Aloo Gobi"
    assert "sourceLanguage" in events[-1]["draft"]  # camelCase on the wire, like the plain response


def test_process_stream_ends_with_error_event(data_dir):
    settings = Settings(demo_mode=True, strategy="nope", data_dir=str(data_dir), _env_file=None)
    events = _stream(TestClient(create_app(settings)))
    assert events[-1]["event"] == "error"
    assert "unknown strategy" in events[-1]["error"]
