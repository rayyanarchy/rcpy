# RCPY

Turn voice notes and dictations into recipes for Crouton, Markdown, and PDF.


## Features

- Speak naturally: English, Hindi or Urdu, mixed however it comes out, with amounts like "adha kilo" or "thoda sa" and corrections halfway through
- A staged AI pipeline (transcribe, extract, verify) on Gemini, with every output validated against a schema
- Measured, not guessed: an eval harness scores each pipeline on hand-checked real recordings (see [engine/evals](engine/evals/README.md)), and the app's How it works page shows the numbers
- Record in the browser with a live waveform, or drop a voice note (M4A, MP3, WAV, WebM, OGG, FLAC)
- Watch it work: each stage and the transcript appear as soon as they're ready
- Review before anything leaves: edit every field in place; rows the model wasn't sure about are marked for you to check
- Export to Crouton (opens the .crumb on a phone, or a QR code on a computer), Markdown, or PDF
- Share a public link that expires after an hour
- Demo mode for trying the whole flow without an API key


## Prerequisites

- Python 3.13+ and [uv](https://docs.astral.sh/uv/)
- Node.js 22.12+ and npm (only for the web app)
- A Google Gemini API key (not needed in demo mode)
- A microphone, or an audio file of a recipe


## Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/rayyanarchy/rcpy.git
   cd rcpy
   ```

2. Copy the example environment file and add your Gemini API key:
   ```bash
   cp .env.example .env
   ```

3. Install the engine (the `--all-extras` flag adds the web API packages):
   ```bash
   cd engine
   uv sync --all-extras
   ```

4. Install the web app (optional):
   ```bash
   cd ../web
   npm install
   ```


## Command line

Run these from `engine/`.

```bash
uv run rcpy parse data/raw/recipe.m4a              # prints JSON
uv run rcpy parse data/raw/a.mp3 data/raw/b.wav -f json,md,html -o data/out/
uv run rcpy parse data/raw/recipe.m4a --share      # prints a link that expires in 1 hour
uv run rcpy parse data/raw/recipe.m4a -s staged    # pick a parse strategy: single, staged, staged-lite
uv run rcpy serve                                  # the web API on http://127.0.0.1:3000
```

`rcpy eval` measures how accurately each strategy works on a set of hand-checked recordings. See [engine/evals/README.md](engine/evals/README.md).

Set `DEMO_MODE=true` to try everything without an API key.

`engine/data/` is where files live that aren't source code: put recordings in `data/raw/`, and outputs go to `data/out/` (the default when you parse several files or several formats without `-o`). Shared recipes are stored in `data/recipes/`. Everything in it is git-ignored.

To run the web app in development, start `uv run rcpy serve` in `engine/` and `npm run dev` in `web/`, then open the URL Vite prints (usually `http://localhost:5173`). After `npm run build` in `web/`, `rcpy serve` also serves the built app itself.


## How To Use (web app)

1. Tap Record and talk through the recipe, or drop in a voice note.
2. Watch RCPY transcribe it, pull out the ingredients and steps, and check them against what you said.
3. Fix anything marked "check", or anything else, right in place.
4. Open it in Crouton, download Markdown or a PDF, or copy a share link. Share links stop working after an hour.


## Configuration

Set these in your `.env` file (in the repo root or `engine/`).

| Variable | Default | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Your Google Gemini API key. Required unless `DEMO_MODE` is on. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Gemini model used to process the audio. |
| `STRATEGY` | `single` | Parse strategy used by the CLI and API: `single`, `staged`, or `staged-lite`. |
| `DEMO_MODE` | `false` | Set to `true` to use a built-in demo recipe instead of calling Gemini. |
| `MAX_AUDIO_MB` | `50` | Maximum audio file size in MB. |
| `DATA_DIR` | `./data` | Where the API stores shared recipes as JSON files when `DATABASE_URL` is not set, and where eval cases live. |
| `EVALS_DIR` | `./evals` | Where eval summaries and `pricing.json` live. |
| `DATABASE_URL` | none | Postgres connection string (for example Neon). Leave empty to use files in `DATA_DIR`. |
| `PUBLIC_BASE_URL` | none | Public URL of the API, used to build share links. Defaults to the request's own host. |
| `SHARE_URL` | `https://rcpy.vercel.app` | Server that `rcpy parse --share` publishes to. |


## Tests

```bash
cd engine && uv run pytest
```


## API

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/process` | Upload audio in the `audio` field and get a recipe draft back. Add `?stream=true` for NDJSON progress events (`plan`, `stage`, `transcript` for staged strategies, then `draft` or `error`) |
| `POST` | `/api/recipes` | Save a recipe |
| `GET` | `/api/recipes/{slug}` | Fetch a saved recipe |
| `PUT` | `/api/recipes/{slug}` | Update a saved recipe |
| `GET` | `/api/recipes/{slug}/crumb` | Download a recipe as a Crouton `.crumb` file |
| `GET` | `/api/recipes/{slug}/md` | Download a recipe as Markdown |
| `GET` | `/r/{slug}` | Public page for a saved recipe |
| `GET` | `/health` | Health check |

FastAPI also serves interactive docs at `/docs`.


## Privacy

Audio you upload is sent to Google's Gemini API for processing, and the app deletes its temporary copy once processing finishes. Saved recipes are stored as text, in Postgres when `DATABASE_URL` is set and as JSON files otherwise, and are deleted automatically one hour after you save them. Anyone with a recipe's link can view it.


## Tech Stack

- Engine: Python 3.13, Google Gen AI SDK (Gemini), Pydantic v2
- CLI: Typer, Rich
- API: FastAPI, Uvicorn
- Storage: JSON files, or Postgres (Neon) via psycopg
- Frontend: React 19, TypeScript, Vite, Lucide icons
- Testing: pytest (engine), Vitest (web); ruff and prettier in CI
- Fonts: Geist and Geist Mono


## Credits

RCPY is an independent project and is not affiliated with or endorsed by Crouton. Geist and Geist Mono are used under the SIL Open Font License.


## License

This project is open source and available under the [MIT License](LICENSE).
