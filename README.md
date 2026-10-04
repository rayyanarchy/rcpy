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
| `STRATEGY` | `staged-lite` | Parse strategy used by the CLI and API: `staged-lite` (transcribe, then extract), `staged` (adds a verify pass), or `single` (one call). The default was chosen by the [evals](#results). |
| `DEMO_MODE` | `false` | Set to `true` to use a built-in demo recipe instead of calling Gemini. |
| `MAX_AUDIO_MB` | `50` | Maximum audio file size in MB. |
| `DATA_DIR` | `./data` | Where the API stores shared recipes as JSON files when `DATABASE_URL` is not set, and where eval cases live. |
| `EVALS_DIR` | `./evals` | Where eval summaries and `pricing.json` live. |
| `DATABASE_URL` | none | Postgres connection string (for example Neon). Leave empty to use files in `DATA_DIR`. |
| `PUBLIC_BASE_URL` | none | Public URL of the API, used to build share links. Defaults to the request's own host. |
| `SHARE_URL` | `https://rcpy.vercel.app` | Server that `rcpy parse --share` publishes to. |


## Results

Three ways of turning a recording into a recipe, compared on 36 recipes dictated by three people (mostly Urdu/Hindi, Hinglish, and English with desi words), each run 3 times on Gemini 3.5 Flash-Lite. The recipes were read from [scripts](engine/evals/scripts/README.md) with mistakes written in on purpose: self-corrections, ranges, "thoda sa", *pav* and *katori*, forgotten and excluded ingredients. Each script carries its own answer key. Scoring is deterministic and described in [engine/evals](engine/evals/README.md).

| | One call | Transcribe → extract (shipped) | + verify pass |
| --- | --- | --- | --- |
| Right ingredient **and** right amount | 94.5% | **97.5%** | 97.0% |
| Ingredient F1 | 99.0% | 98.7% | 98.5% |
| Servings or times made up (across 108 runs) | 126 | 54 | **36** |
| Spoken steps that made it into the method | **87%** | 84% | 78% |
| Latency per recipe | **6.0s** | 6.5s | 10.0s |
| Cost per recipe | $0.0032 | $0.0034 | $0.0060 |

On the 12 held-out recipes, which nothing was tuned on, the ranking is the same: 95.7% / 95.9% / 96.5% for right ingredient and amount, and 46 / 21 / 12 servings or times made up.

What this shows:

- **Finding ingredients is close to solved; amounts and made-up details are where pipelines differ.** Splitting transcription from extraction cut wrong amounts by more than half (5.5% → 2.5%) and made-up servings and times by 57%, for half a second and $0.0002 more per recipe.
- **A verify pass reduces made-up details further, but it costs more than it gains.** It's about 50% slower, nearly twice the cost, and it condenses the method, dropping spoken detail from the steps. Transcribe → extract is the default; `STRATEGY=staged` turns the verify pass on.
- **Remaining errors are the hard kind:** "aath" (eight) bread slices heard as "aadha" (half), and chole masala in tablespoons came back as teaspoons.
- **Caveats:** read-aloud speech is more fluent than spontaneous speech, so a set of unscripted recordings is next. The step metric compares words, so rewording counts against a pipeline even when nothing was lost.

## Deploying to Vercel

The repo deploys as one Vercel project from the root: `vercel.json` builds the web app into `web/dist` and runs the engine as a single Python function (`api/index.py`, with dependencies pinned in `requirements.txt`). Uploads are capped at 4 MB there, because Vercel limits request bodies to 4.5 MB.

Set these in the project's environment variables (for Preview too, if you deploy branches):

| Variable | Needed | Why |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Processing recordings |
| `DATABASE_URL` | yes | Share links. Without it, saved recipes live in one function instance's temp folder and links break. |
| `PUBLIC_BASE_URL` | no | Leave unset so links use each deployment's own domain |

After changing dependencies in `engine/pyproject.toml`, regenerate `requirements.txt` with the command at its top.


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


## Roadmap

- [x] Staged pipeline (transcribe, extract, verify) alongside the original single-call baseline
- [x] Eval harness with deterministic scoring for ingredients, quantities, steps and invented values
- [x] Redesigned web app in TypeScript, with live progress, inline review and Crouton export
- [x] Record 36 scripted family dictations with answer keys, a third of them held out
- [x] Benchmark single, staged and staged-lite on them, and make the winner (staged-lite) the default
- [x] Add Gemini prices so the results include cost per recipe
- [ ] Unscripted ("freestyle") recordings, to check how far the scripted numbers carry over
- [ ] Publish the numbers on the How it works page, with real failure examples
- [ ] Show where each ingredient came from: the matching words in the transcript, with replay of that moment of the audio
- [ ] Screenshots and a write-up of the approach and results in this README
- [ ] Deploy the beta


## Credits

RCPY is an independent project and is not affiliated with or endorsed by Crouton. Geist and Geist Mono are used under the SIL Open Font License.


## License

This project is open source and available under the [MIT License](LICENSE).
