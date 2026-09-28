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

- Node.js 22.12+ and npm
- A Google Gemini API key (not needed in demo mode)
- A microphone, or an audio file of a recipe


## Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/rayyanarchy/rcpy.git
   cd rcpy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file and add your Gemini API key:
   ```bash
   cp .env.example .env
   ```

4. Start the app:
   ```bash
   npm run dev
   ```
   Open the URL Vite prints in your terminal (usually `http://localhost:5173`).


## How To Use

1. Record a recipe by reading it aloud, or upload an audio file.
2. Wait a moment while the AI turns it into a structured recipe.
3. Review the result and edit anything that needs fixing.
4. Save the recipe to get a shareable link and QR code. They stay valid for one hour, so import or export the recipe before then.
5. Export the recipe to Crouton, Markdown, or PDF.


## Configuration

Set these in your `.env` file.

| Variable | Default | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Your Google Gemini API key. Required unless `DEMO_MODE` is on. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Gemini model used to process the audio. |
| `DEMO_MODE` | `false` | Set to `true` to use a built-in demo recipe instead of calling Gemini. |
| `MAX_AUDIO_MB` | `50` (`4` on Vercel) | Maximum audio upload size in MB. |
| `PORT` | `3000` | Port for the API server. |
| `DATA_DIR` | `./data` (`/tmp/rcpy` on Vercel) | Where recipes are stored as JSON files when `DATABASE_URL` is not set. |
| `DATABASE_URL` | none | Neon Postgres connection string. Leave empty to store recipes as files in `DATA_DIR`. |
| `PUBLIC_BASE_URL` | none | Public URL of the app, used to build share links and QR codes. |


## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the server and the Vite dev client together with hot reload |
| `npm run build` | Builds the client for production |
| `npm start` | Runs the server, loading `.env` if present |
| `npm test` | Runs the test suite once |
| `npm run test:watch` | Runs the tests in watch mode |


## API

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/process` | Upload audio in the `audio` field and get a recipe draft back |
| `POST` | `/api/recipes` | Save a recipe |
| `GET` | `/api/recipes/:slug` | Fetch a saved recipe |
| `PUT` | `/api/recipes/:slug` | Update a saved recipe |
| `GET` | `/api/recipes/:slug/crumb` | Download a recipe as a Crouton `.crumb` file |
| `GET` | `/api/recipes/:slug/md` | Download a recipe as Markdown |
| `GET` | `/r/:slug` | Public page for a saved recipe |
| `GET` | `/health` | Health check |


## Privacy

Audio you upload is sent to Google's Gemini API for processing, and the server deletes its temporary copy once processing finishes. Saved recipes are stored as text, in Neon Postgres when `DATABASE_URL` is set and as JSON files otherwise, and are deleted automatically one hour after you save them. Anyone with a recipe's link can view it.


## Tech Stack

- AI: Google Gen AI SDK (Gemini), Zod for schema validation
- Frontend: React 19, Vite, Lucide icons
- Backend: Node.js, Express 5, Multer (audio uploads)
- Database: Neon serverless Postgres
- Testing: Vitest, Supertest
- Hosting: Vercel
- Fonts: DM Sans, Fraunces, Figtree, Instrument Serif


## Credits

RCPY is an independent project and is not affiliated with or endorsed by Crouton. The fonts are used under the SIL Open Font License, and the license texts for the bundled Figtree and Instrument Serif files are in `public/fonts`.


## License

This project is open source and available under the [MIT License](LICENSE).
