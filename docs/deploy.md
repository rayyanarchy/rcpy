# Deploying to Vercel

RCPY runs as **one Vercel project** from the repo root: the web app is built to static files, and the engine runs as a single Python function. Production is **https://rcpy.vercel.app**, deployed from `main`. Every other branch gets a preview deployment, for example `beta` at `https://rcpy-git-beta-<team>.vercel.app`. Previews are behind Vercel Authentication unless you turn that off.

## How the project is wired

| Piece | File | What it does |
| --- | --- | --- |
| Build | `vercel.json` | `installCommand`: `cd web && npm ci --include=dev`. `buildCommand`: `cd web && npm run build:vercel`. `outputDirectory`: `web/dist`. |
| Function | `api/index.py` | Imports `engine/src`, builds the FastAPI app, and restores the requested path from the rewrite. |
| Python deps | `requirements.txt` | Exported from `engine/uv.lock`. Regenerate it after changing engine dependencies (the command is at the top of the file). |
| Routing | `vercel.json` rewrites | `/api/*`, `/r/*` and `/health` go to the function, passing the original path as `__rcpy_path`. `/how-it-works` goes to `index.html`. Everything else is static. |

`npm run build:vercel` sets `VITE_MAX_AUDIO_MB=4`, so the web app rejects files over 4 MB before uploading them. Vercel caps request bodies at 4.5 MB. The browser recorder uses 32 kbps, which fits about 15 minutes into that.

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables, for **Production and Preview**:

| Variable | Needed | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Processing fails with a 503 without it. |
| `DATABASE_URL` | yes | Postgres (for example Neon). Without it, saved recipes go to the function's temp folder, so share links only work on whichever instance saved them. |
| `STRATEGY` | no | Default `staged-lite`. `staged` adds the verify pass. |
| `GEMINI_MODEL` | no | Default `gemini-3.5-flash-lite`. |
| `PUBLIC_BASE_URL` | no | **Leave unset**, so links use each deployment's own domain. If it's set for Preview, preview share links point at production. |

The project also has `NODE_ENV=production`. That's why the install command passes `--include=dev`: TypeScript and Vite are dev dependencies, and npm skips those in production mode.

## Releasing

1. Push to a branch and check its preview deployment: open `/health`, process a short recording, save it, and open the share link in a private window.
2. Merge into `main`. Vercel deploys production automatically, and CI (`.github/workflows/ci.yml`) runs on the same push.
3. Check https://rcpy.vercel.app/health returns `{"ok":true}`, then process one real recording.

**Rolling back:** in Vercel → Deployments, open the last good production deployment and choose **Promote to Production** (or "Instant Rollback"). Then revert the commit on `main` so the next deploy doesn't bring the problem back.

## When something goes wrong

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Build fails with `tsc: command not found` (exit 127) | Dev dependencies weren't installed. | Keep `--include=dev` in `installCommand`. |
| Upload fails instantly with 413 | File over 4.5 MB. | Expected on Vercel. Use a shorter or more compressed recording. |
| "RCPY is getting more requests than it can handle" | Gemini rate limit or daily quota. On the free tier that's 15 requests a minute and 500 a day; each recipe uses 2. | Wait, or enable billing on the Gemini key. |
| Share links open "This recipe is gone" straight away | No `DATABASE_URL`, so the link was stored on another instance's temp folder. | Set `DATABASE_URL`. |
| Share links point at the wrong domain | `PUBLIC_BASE_URL` is set. | Unset it for that environment. |
| `/how-it-works` 404s on refresh | A new client route without a rewrite. | Add it to the rewrites in `vercel.json` and to `SPA_PAGES` in `engine/src/rcpy/api.py`. |

Function logs are in Vercel → Deployments → (deployment) → Logs. Gemini's raw error text is logged there under the `rcpy` logger. People only see the short message.

## Running it without Vercel

Any host that can run Python works. Build the web app, and `rcpy serve` will serve both the app and the API:

```bash
cd web && npm ci && npm run build
cd ../engine && uv sync --all-extras
uv run rcpy serve --host 0.0.0.0 --port 3000
```

Put it behind a proxy that sets `X-Forwarded-Proto`, or set `PUBLIC_BASE_URL`, so share links get the right scheme and host.
