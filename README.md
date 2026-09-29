# RCPY

Turn voice notes and dictations into recipes for Crouton, Markdown, and PDF.


## Features

- AI recipe extraction: Gemini turns your recording into a structured recipe, validated against a schema so the output is always consistent
- Record in the browser with a live waveform, or upload an existing audio file (MP3, M4A, WAV, MP4, OGG, FLAC, or WebM)
- Review and edit the recipe before you save it
- Export to Crouton, Markdown, or PDF
- Share each saved recipe with a public link and a QR code that stay valid for one hour
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
uv run rcpy serve                                  # the web API on http://127.0.0.1:3000
```

Set `DEMO_MODE=true` to try everything without an API key.

`engine/data/` is where files live that aren't source code: put recordings in `data/raw/`, and outputs go to `data/out/` (the default when you parse several files or several formats without `-o`). Shared recipes are stored in `data/recipes/`. Everything in it is git-ignored.

To run the web app in development, start `uv run rcpy serve` in `engine/` and `npm run dev` in `web/`, then open the URL Vite prints (usually `http://localhost:5173`). After `npm run build` in `web/`, `rcpy serve` also serves the built app itself.


## How To Use (web app)

1. Record a recipe by reading it aloud, or upload an audio file.
2. Wait a moment while the AI turns it into a structured recipe.
3. Review the result and edit anything that needs fixing.
4. Save the recipe to get a shareable link and QR code. They stay valid for one hour, so import or export the recipe before then.
5. Export the recipe to Crouton, Markdown, or PDF.


## Configuration

Set these in your `.env` file (in the repo root or `engine/`).

| Variable | Default | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Your Google Gemini API key. Required unless `DEMO_MODE` is on. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Gemini model used to process the audio. |
| `DEMO_MODE` | `false` | Set to `true` to use a built-in demo recipe instead of calling Gemini. |
| `MAX_AUDIO_MB` | `50` | Maximum audio file size in MB. |
| `DATA_DIR` | `./data` | Where the API stores shared recipes as JSON files when `DATABASE_URL` is not set. |
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
| `POST` | `/api/process` | Upload audio in the `audio` field and get a recipe draft back |
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
- Frontend: React 19, Vite, Lucide icons
- Testing: pytest
- Fonts: DM Sans, Fraunces, Figtree, Instrument Serif


## Credits

RCPY is an independent project and is not affiliated with or endorsed by Crouton. The fonts are used under the SIL Open Font License, and the license texts for the bundled Figtree and Instrument Serif files are in `web/public/fonts`.


## License

This project is open source and available under the [MIT License](LICENSE).
