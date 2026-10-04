# Development

Everything needed to work on RCPY: setup, the commands you'll use daily, how the code is laid out, and how to make the common kinds of change. For how the pieces fit together, read [architecture.md](architecture.md) first.

## Setup

You need Python 3.13+ with [uv](https://docs.astral.sh/uv/), and Node.js 22.12+.

```bash
git clone https://github.com/rayyanarchy/rcpy.git && cd rcpy
cp .env.example .env                 # add GEMINI_API_KEY, or set DEMO_MODE=true
cd engine && uv sync --all-extras    # engine, CLI, API and dev tools
cd ../web && npm ci                  # web app
```

`.env` is read from the directory you run commands in, or its parent, so the repo-root file works from `engine/`. The variables are listed in the [README](../README.md#configuration).

**Demo mode** (`DEMO_MODE=true`) skips Gemini entirely: every recording returns the same sample recipe, and the progress stages still play. Use it to work on the UI or API without a key or quota.

## Running it

Two terminals:

```bash
cd engine && uv run rcpy serve --reload   # API on http://127.0.0.1:3000
cd web && npm run dev                     # app on http://localhost:5173
```

Vite proxies `/api`, `/r/` and `/health` to port 3000, so the engine must be running. If it isn't, the app says "Can't reach the RCPY engine".

To try it on a phone on the same Wi-Fi, build the app and let the engine serve it on your network:

```bash
cd web && npm run build
cd ../engine && uv run rcpy serve --host 0.0.0.0   # open http://<your-computer's-ip>:3000
```

Without the web app, the CLI parses files directly:

```bash
cd engine
uv run rcpy parse data/raw/recipe.m4a                       # JSON to stdout
uv run rcpy parse a.m4a b.mp3 -f json,md,html -o data/out/  # several files and formats
uv run rcpy parse recipe.m4a -s staged                      # pick a strategy
uv run rcpy parse recipe.m4a --share                        # publish to SHARE_URL and print the link
```

`engine/data/` is for files that aren't code: `raw/` for recordings, `out/` for outputs, `recipes/` for locally saved recipes, `evals/` for eval cases and cached runs. It's all git-ignored.

## Checks

CI runs all of these on every push to `main` and `beta`, and on pull requests:

```bash
cd engine
uv run ruff check src tests && uv run ruff format --check src tests
uv run pytest                                  # no test calls Gemini

cd ../web
npm run format:check                           # prettier
npm test                                       # vitest
npm run build                                  # typechecks with tsc first
```

`uv run ruff format src tests` and `npm run format` fix formatting.

## Layout

```text
engine/
  src/rcpy/
    schema.py          recipe models: the model's response schema and validation
    draft.py           API models (camelCase on the wire)
    strategies/        parse strategies + the Gemini wrapper (_gemini.py)
    api.py             FastAPI app
    storage.py         Postgres / JSON-file stores with 1-hour expiry
    formatters.py      JSON, Markdown, HTML page, .crumb, JSON-LD
    evals/             scoring, runner and `rcpy eval` CLI
    cli.py, config.py, trace.py, ratelimit.py, share.py
  evals/
    scripts/           36 dictation scripts with answer keys
    results/           committed eval summaries (bundled into the web app)
    README.md          how the evals work, scoring rules, changelog
  tests/
web/src/
  App.tsx              the flow: home -> recording -> processing -> review
  screens/             one component + one CSS file per screen
  lib/                 API client, types, exports, quantity parser, router, results
  hooks/useRecorder.ts
  styles/base.css      design tokens and shared button styles
api/index.py           Vercel entrypoint
docs/                  these docs, ADRs, screenshots
```

## Common changes

**Changing a prompt or a strategy.** Prompts live in `strategies/single.py` and `strategies/staged.py`. After a change, measure it: run the evals for that strategy (`uv run rcpy eval run -s staged-lite -n 3`), compare with `uv run rcpy eval compare`, and note the change and its effect in `engine/evals/README.md`. Each run of the full set is about 216 Gemini requests for `staged-lite`, so on the free tier you get two runs a day.

**Adding a strategy.** Write `run(gemini, path, mime) -> ParseResult` in a new module, register it in `STRATEGIES` and its stage names in `STAGES` (`strategies/__init__.py`), add labels in `web/src/screens/Processing.tsx`, and add it to `STRATEGIES` in `web/src/lib/results.ts` so it appears in the results table.

**Changing the recipe schema.** `schema.py` is what Gemini is asked to produce, so changes must stay within what the google-genai SDK accepts as a schema. Update `draft.py`, `web/src/lib/types.ts`, the formatters, and the demo recipe (`strategies/demo.py`) to match.

**Adding a page to the web app.** Add the route in `App.tsx`, add the path to `SPA_PAGES` in `api.py` (for `rcpy serve`) and to the rewrites in `vercel.json` (for Vercel), so a refresh doesn't 404.

**Changing the scoring.** Edit `evals/match.py` or `evals/metrics.py`, add a test in `tests/test_evals.py`, re-grade every run with `uv run rcpy eval rescore <run_id>` (no model calls), and record the change under "Scoring changes" in `engine/evals/README.md`.

**Recording more eval cases.** See [engine/evals/scripts/README.md](../engine/evals/scripts/README.md). A recording named after its script is scored with no labelling.

## Conventions

- **Errors:** raise `RcpyError(message, status=...)` with a message a person can act on. The API turns it into `{"error": message}`, and the web app shows that text directly.
- **CLI output:** progress and errors go to stderr, so stdout stays pipe-friendly. The exit code is 1 if any file failed.
- **Tests:** API tests use FastAPI's `TestClient` with `demo_mode=True` and a temp data dir. Nothing calls Gemini; the Gemini wrapper is faked where needed (`tests/test_staged.py`).
- **Commits:** small, one change each, in conventional-commit style (`feat(web): …`, `fix(engine): …`), with a body that says why.
- **Decisions:** anything with real trade-offs gets an ADR in `docs/adr/`.
