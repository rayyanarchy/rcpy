"""FastAPI app. Same routes and JSON shapes as the old Express server."""

import json
import logging
import re
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from rcpy.config import Settings, get_settings
from rcpy.draft import DraftResponse, PublishResponse, RecipeDraft, RecipeResponse
from rcpy.errors import RcpyError
from rcpy.formatters import PageInfo, to_crumb, to_html, to_markdown
from rcpy.ratelimit import RateLimiter
from rcpy.storage import Store, get_store
from rcpy.strategies import parse_audio

log = logging.getLogger("rcpy")

ALLOWED_EXTENSIONS = {".flac", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".ogg", ".wav", ".webm"}
DEFAULT_WEB_DIST = Path(__file__).resolve().parents[3] / "web" / "dist"


def _error(status: int, message: str, **extra) -> JSONResponse:
    # The React app reads `error` from every failure response.
    return JSONResponse(status_code=status, content={"error": message, **extra})


def _base_url(request: Request, settings: Settings) -> str:
    if settings.public_base_url:
        return settings.public_base_url.rstrip("/")
    proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip() or request.url.scheme
    return f"{proto}://{request.headers.get('host', request.url.netloc)}"


def _file_name(name: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name, flags=re.I)) or "recipe"


def _save_upload(upload: UploadFile, settings: Settings) -> Path:
    """Stream the upload to a temp file, stopping if it is over the size limit."""
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise RcpyError("Use an MP3, M4A, WAV, MP4, OGG, FLAC, or WebM audio file.")
    limit = int(settings.max_audio_mb * 1024 * 1024)
    written = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        try:
            while chunk := upload.file.read(1024 * 1024):
                written += len(chunk)
                if written > limit:
                    raise RcpyError(f"Audio files must be {settings.max_audio_mb:g} MB or smaller.")
                tmp.write(chunk)
        except BaseException:
            Path(tmp.name).unlink(missing_ok=True)
            raise
    return Path(tmp.name)


def create_app(settings: Settings | None = None, store: Store | None = None) -> FastAPI:
    settings = settings or get_settings()
    store = store or get_store(settings)
    app = FastAPI(title="RCPY", description="Dictated recipes to structured recipes.")

    process_limit = RateLimiter(10, 3600, "Too many uploads. Please try again later.")
    write_limit = RateLimiter(60, 3600, "Too many requests. Please try again later.")

    # ---- errors: always {"error": "..."} ----------------------------------

    @app.exception_handler(RcpyError)
    async def _rcpy_error(_req: Request, exc: RcpyError):
        return _error(exc.status, str(exc))

    @app.exception_handler(HTTPException)
    async def _http_error(_req: Request, exc: HTTPException):
        return _error(exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_req: Request, exc: RequestValidationError):
        details = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        return _error(400, "Some recipe fields are incomplete or invalid.", details=details)

    @app.exception_handler(Exception)
    async def _unexpected(_req: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return _error(500, "Something went wrong.")

    def _links(request: Request, slug: str) -> dict:
        base = _base_url(request, settings)
        return {
            "url": f"{base}/r/{slug}",
            "crumb_url": f"{base}/api/recipes/{slug}/crumb",
            "markdown_url": f"{base}/api/recipes/{slug}/md",
        }

    def _must_get(slug: str):
        recipe = store.get(slug)
        if recipe is None:
            raise HTTPException(404, "Recipe not found.")
        return recipe

    # ---- routes ------------------------------------------------------------

    @app.get("/health")
    def health():
        return {"ok": True}

    # Plain `def` (not async): FastAPI runs these in a threadpool, which is
    # right for the blocking Gemini call.
    @app.post("/api/process", response_model=DraftResponse, dependencies=[Depends(process_limit)])
    def process(audio: UploadFile | None = File(None)):
        if audio is None:
            raise RcpyError("Choose an audio file first.")
        path = _save_upload(audio, settings)
        try:
            return {"draft": RecipeDraft.from_result(parse_audio(path, settings))}
        finally:
            path.unlink(missing_ok=True)

    @app.post(
        "/api/recipes", status_code=201, response_model=PublishResponse, dependencies=[Depends(write_limit)]
    )
    def create_recipe(draft: RecipeDraft, request: Request):
        recipe = store.save(draft)
        return {"recipe": recipe, **_links(request, recipe.slug)}

    @app.get("/api/recipes/{slug}", response_model=RecipeResponse)
    def read_recipe(slug: str):
        return {"recipe": _must_get(slug)}

    @app.put("/api/recipes/{slug}", response_model=PublishResponse, dependencies=[Depends(write_limit)])
    def update_recipe(slug: str, draft: RecipeDraft, request: Request):
        recipe = store.update(slug, draft)
        if recipe is None:
            raise HTTPException(404, "Recipe not found.")
        return {"recipe": recipe, **_links(request, recipe.slug)}

    @app.get("/api/recipes/{slug}/crumb")
    def download_crumb(slug: str, request: Request):
        recipe = _must_get(slug)
        body = json.dumps(to_crumb(recipe, _base_url(request, settings)))
        return Response(
            body,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{_file_name(recipe.name)}.crumb"'},
        )

    @app.get("/api/recipes/{slug}/md")
    def download_markdown(slug: str, request: Request):
        recipe = _must_get(slug)
        link = f"{_base_url(request, settings)}/r/{recipe.slug}"
        return Response(
            to_markdown(recipe.to_result(), link=link),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{_file_name(recipe.name)}.md"'},
        )

    @app.get("/r/{slug}", response_class=HTMLResponse)
    def recipe_page(slug: str, request: Request):
        recipe = store.get(slug)
        if recipe is None:
            return HTMLResponse("<h1>Recipe not found</h1>", status_code=404)
        page = PageInfo(_base_url(request, settings), recipe.slug, recipe.created_at, recipe.updated_at)
        return HTMLResponse(to_html(recipe.to_result(), page))

    # Serve the built React app if it exists (`npm run build` in web/). Mounted
    # last so every route above wins.
    dist = Path(DEFAULT_WEB_DIST)
    if (dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=dist, html=True), name="web")

    return app
