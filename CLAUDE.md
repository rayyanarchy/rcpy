# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

RCPY turns dictated recipe audio into structured recipes (JSON / Markdown / HTML / Crouton `.crumb`). Two parts: a Python engine in `engine/` (library + Typer CLI + FastAPI server) and a React/Vite web app in `web/` that talks to that API.

## Commands

Engine (run from `engine/`, uses `uv`, Python 3.13+):

```bash
uv sync --all-extras                      # install, including the FastAPI/psycopg "api" extra
uv run pytest                             # all tests
uv run pytest tests/test_api.py::test_health   # single test
uv run ruff check src tests && uv run ruff format src tests   # lint + format (CI enforces both)
uv run rcpy parse data/raw/recipe.m4a     # one file + one format -> stdout
uv run rcpy parse a.mp3 b.wav -f json,md,html -o data/out/
uv run rcpy serve --reload                # API on http://127.0.0.1:3000
```

Set `DEMO_MODE=true` to skip Gemini entirely (returns a canned recipe) — useful for exercising the CLI/API/web flow without an API key.

Web (run from `web/`, Node 22.12+): `npm run dev` (Vite on :5173, proxies `/api`, `/r`, `/health` to :3000 — so `rcpy serve` must be running), `npm run build` (typechecks with `tsc` first), `npm test` (vitest).

CI (`.github/workflows/ci.yml`) runs ruff check, ruff format --check and pytest for the engine, and `npm test` + `npm run build` for the web app.

## Architecture

**Data flow:** audio file → `strategies.parse_audio` (validates type/size, then dispatches to the strategy named by `settings.strategy` or the `strategy` argument) → `ParseResult` → either `formatters.render()` (CLI) or `RecipeDraft.from_result()` (API).

**Model layers — keep these distinct:**
- `schema.py` — `ParseResult`/`Recipe`/`Ingredient`/`Step`/`Unit`. Single source of truth: the same Pydantic models are passed to Gemini as the response schema *and* used to validate the reply. Changing these changes what Gemini is asked to produce, and must stay compatible with what the google-genai SDK accepts as a schema.
- `draft.py` — API-facing `RecipeDraft` (flattened `ParseResult` with a UUID on every ingredient/step so the editor can track rows) and `StoredRecipe` (adds slug/timestamps/expiry). These serialize with **camelCase aliases on the wire** (the React app's convention) while staying snake_case in Python; always dump with `by_alias=True` when producing JSON for the web app or storage. `to_result()` converts back for the formatters.

**Strategies (`strategies/`):** each is a `run(gemini, path, mime) -> ParseResult` registered in `STRATEGIES`. `single` is one multimodal call (the original baseline); `staged` is transcribe → extract → verify, and `staged-lite` skips verify (an ablation). All Gemini access goes through `_gemini.Gemini`, which uploads/deletes audio, validates against a schema, maps SDK/network errors to `RcpyError`, and records each call's latency and tokens into an optional `trace.Trace`. `demo.py` is the canned `DEMO` result (returned in demo mode, also the pytest `result` fixture).

**Evals (`evals/` package + `engine/evals/`):** `rcpy eval add|list|run|rescore|compare`. Cases (audio + hand-checked `gold.json`, a `GoldCase`) live in git-ignored `<DATA_DIR>/evals/cases/`; raw predictions are cached in `<DATA_DIR>/evals/runs/<run_id>/` so `rescore` needs no model calls; summaries go to the committed `engine/evals/results/<run_id>.json` (`EVALS_DIR`). Scoring (`match.py`, `metrics.py`) is deterministic: fuzzy ingredient alignment with a Hindi/Urdu synonym table, unit-equivalent quantity comparison, lexical step coverage. `engine/evals/README.md` is the recording/annotation guide — keep it in sync with the metric semantics.

**API (`api.py`):** built via the `create_app(settings, store)` factory (tests inject `Settings(..., _env_file=None)`). Every error response is `{"error": "..."}` because `web/src/lib/api.js` reads that field — raise `RcpyError(message, status=...)` from engine code and the handler maps it. Blocking routes (Gemini call) are plain `def` so FastAPI runs them in a threadpool. If `web/dist/index.html` exists, the built SPA is mounted at `/` after all API routes. Per-IP in-memory rate limits (`ratelimit.py`) guard process and write routes.

**Storage (`storage.py`):** abstract `Store` implements save/get/update and expiry (1-hour TTL; edits do not extend it; expired rows are deleted lazily on read); subclasses only implement `_read`/`_write`/`_delete`. `PostgresStore` when `DATABASE_URL` is set (table `rcpy_recipes`, kept compatible with the old Node app's schema), otherwise `FileStore` writing JSON to `<DATA_DIR>/recipes/`. Slugs are validated against `SLUG_RE` before any lookup.

**`rcpy parse --share`** (`share.py`) POSTs the draft to `SHARE_URL`'s `/api/recipes`, i.e. the CLI is a client of a deployed RCPY server, not the local one.

**Config:** `config.Settings` (pydantic-settings) reads env vars or `.env` from the cwd or its parent, so the repo-root `.env` works when running from `engine/`. See the README's Configuration table for variables.

**Data folder:** `engine/data/` (`raw/` recordings, `out/` outputs, `recipes/` FileStore, `evals/` eval cases and cached runs) is git-ignored apart from `.gitkeep`s; `DATA_DIR` defaults to `./data`, so paths are relative to where commands run (normally `engine/`).

## Conventions

- CLI writes progress/errors to stderr (Rich console) so stdout stays pipe-friendly; exit code 1 if any file fails.
- Engine tests use FastAPI's `TestClient` with `demo_mode=True` and a `tmp_path` data dir; CLI tests set `DEMO_MODE` via `monkeypatch`. No test hits Gemini.
