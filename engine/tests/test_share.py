import httpx
import pytest
from fastapi.testclient import TestClient

from rcpy.api import create_app
from rcpy.config import Settings
from rcpy.errors import RcpyError
from rcpy.share import share_recipe


def test_share_round_trip(result, tmp_path):
    settings = Settings(demo_mode=True, data_dir=str(tmp_path), public_base_url="https://rcpy.example", _env_file=None)
    client = TestClient(create_app(settings))

    links = share_recipe(result, "http://testserver", client=client)

    assert links.url.startswith("https://rcpy.example/r/")
    slug = links.url.rsplit("/", 1)[1]
    assert client.get(f"/r/{slug}").status_code == 200


def test_share_reports_server_errors(result):
    def handler(request):
        return httpx.Response(429, json={"error": "Too many requests. Please try again later."})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(RcpyError, match="Too many requests"):
        share_recipe(result, "https://rcpy.example", client=client)


def test_share_rejects_invalid_recipe_before_sending(result):
    result.recipe.servings = 0
    with pytest.raises(RcpyError, match="can't be shared"):
        share_recipe(result, "https://rcpy.example")


def test_share_unreachable_server(result):
    def handler(request):
        raise httpx.ConnectError("boom")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(RcpyError, match="could not reach"):
        share_recipe(result, "https://rcpy.example", client=client)
