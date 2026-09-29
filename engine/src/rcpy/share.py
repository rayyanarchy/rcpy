"""`rcpy parse --share`: publish a recipe to a running RCPY server and get a link + QR code."""

import io
from dataclasses import dataclass
from pathlib import Path

import httpx
import segno
from pydantic import ValidationError

from rcpy.draft import RecipeDraft
from rcpy.errors import RcpyError
from rcpy.schema import ParseResult


@dataclass
class ShareLinks:
    url: str
    crumb_url: str
    markdown_url: str


def share_recipe(result: ParseResult, share_url: str, client: httpx.Client | None = None) -> ShareLinks:
    """POST the recipe to <share_url>/api/recipes. Links expire after one hour."""
    try:
        draft = RecipeDraft.from_result(result)
    except ValidationError as exc:
        raise RcpyError(f"this recipe can't be shared: {exc.errors()[0]['msg']}") from exc
    endpoint = f"{share_url.rstrip('/')}/api/recipes"
    try:
        post = client.post if client else httpx.post
        response = post(
            endpoint,
            content=draft.model_dump_json(by_alias=True),
            headers={"content-type": "application/json"},
            timeout=30,
        )
    except httpx.HTTPError as exc:
        raise RcpyError(f"could not reach {share_url}: {exc}") from exc

    if response.status_code != 201:
        try:
            message = response.json()["error"]
        except Exception:
            message = f"HTTP {response.status_code}"
        raise RcpyError(f"share failed: {message}")

    data = response.json()
    return ShareLinks(url=data["url"], crumb_url=data["crumbUrl"], markdown_url=data["markdownUrl"])


def qr_terminal(url: str) -> str:
    out = io.StringIO()
    segno.make(url, error="m").terminal(out=out, compact=True, border=2)
    return out.getvalue()


def qr_png(url: str, path: Path) -> None:
    segno.make(url, error="m").save(str(path), scale=10, border=2)
