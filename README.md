# Crumbly

Crumbly turns a dictated recipe into:

- an editable English recipe;
- a public recipe page with Schema.org `Recipe` JSON-LD;
- a QR code containing that page's URL; and
- a downloadable `.crumb` file matching the structure observed in
  `Lasagna.crumb`.

`Lasagna OG.crumb` is a backup/reference file and is not used or modified by
the app.

## How it works

1. The browser uploads an audio recording to the Node server.
2. Gemini transcribes it in the original language.
3. Gemini translates and extracts the English recipe in one structured response.
4. The user reviews every field. Uncertain details are visibly marked.
5. Publishing writes the recipe JSON to the persistent data directory.
6. The public page exposes ordinary HTML and Schema.org Recipe JSON-LD.
7. The QR contains only the public page URL, keeping it small and easy to scan.

Uploaded audio is deleted from the server after processing, including when
processing fails. The recipe text remains on disk until its JSON file is
removed.

## Requirements

- Node.js 22.12 or newer
- A [Google AI Studio Gemini API key](https://aistudio.google.com/apikey)

## Run locally

```bash
cp .env.example .env
```

Open `.env` and set:

```dotenv
GEMINI_API_KEY=your_key_here
PUBLIC_BASE_URL=http://localhost:3000
```

Then:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API and generated
recipe pages run on port `3000`.

For a UI-only test that does not call Gemini, set `DEMO_MODE=true` in `.env`.
This returns the included Aloo Gobi example after any supported file is
uploaded.

## Production build

```bash
npm test
npm run build
npm start
```

The production server serves both the built React app and the API from
[http://localhost:3000](http://localhost:3000).

## Host on Railway

Railway is a good fit for this version because one Node service and one
persistent volume are enough.

### 1. Push the folder to GitHub

This folder is not currently a Git repository. From this directory:

```bash
git init
git add .
git commit -m "Build Crumbly audio recipe importer"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/crumbly.git
git push -u origin main
```

Create the empty `crumbly` repository on GitHub before the final two commands.
Do not commit `.env`; it is already ignored.

### 2. Create the Railway service

1. Open [Railway](https://railway.com/new).
2. Choose **Deploy from GitHub repo**.
3. Select the repository.
4. Railway should detect Node.js and use `npm run build` followed by
   `npm start`.

Railway's current Express deployment guide documents the same GitHub flow:
[Deploy an Express App](https://docs.railway.com/guides/express).

### 3. Add the environment variables

In the service's **Variables** tab add:

```dotenv
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-3.5-flash-lite
DATA_DIR=/app/data
MAX_AUDIO_MB=50
DEMO_MODE=false
NODE_ENV=production
```

Do not add `PORT`; Railway provides it automatically.

`PUBLIC_BASE_URL` is optional because the server derives the URL from the
incoming request. If you later add a custom domain, set it to the canonical
address, for example:

```dotenv
PUBLIC_BASE_URL=https://recipes.example.com
```

### 4. Attach persistent storage

1. Add a Railway Volume to the Crumbly service.
2. Set its mount path to `/app/data`.
3. Redeploy the service.

Railway applications live under `/app`, so `/app/data` is the correct
persistent mount for this app's recipe files. See
[Railway Volumes](https://docs.railway.com/volumes).

Keep this version at **one replica**. The app deliberately uses simple JSON
files instead of a database, and a single attached volume should have a single
writer. Move recipes to Postgres or object storage before scaling horizontally.

### 5. Generate the public domain

In the service's **Settings → Networking** section, choose
**Generate Domain**. Open the generated URL and confirm:

```text
https://YOUR-DOMAIN/health
```

returns:

```json
{"ok":true}
```

Set the service health-check path to `/health`.

### 6. Test the actual Crouton handoff

1. Upload a short dictated recipe.
2. Correct the generated fields.
3. Publish it.
4. Scan the QR using Crouton's QR import.
5. Confirm the title, servings, times, ingredients, and steps.
6. If Crouton's website importer misses a field, download and test the
   `.crumb` fallback.

This real-device scan is the final compatibility check because Crouton's
website parser is not publicly documented.

## Privacy and operational notes

- Audio is sent to Gemini for transcription and then deleted locally. The temporary
  Gemini Files API upload is deleted after processing as well.
- Published recipe pages are reachable by anyone with their unguessable link.
- Pages include `noindex, nofollow`, but that is not access control.
- Recipe JSON is stored under `DATA_DIR/recipes`.
- The API key stays on the server and is never included in the browser bundle.
- Back up the Railway volume if the recipes matter long-term.

## Useful commands

```bash
npm run dev       # React dev server + watched Node API
npm test          # API and formatter tests
npm run build     # Production React bundle
npm start         # Production server
```
