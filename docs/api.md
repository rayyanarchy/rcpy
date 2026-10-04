# API reference

The engine's HTTP API, served by `rcpy serve` locally and by `api/index.py` on Vercel. It has no authentication: anyone who can reach the server can process audio, and anyone with a recipe's link can read it. Interactive docs are at `/docs` when the server is running.

Conventions:

- JSON bodies use **camelCase** keys.
- Every error is `{"error": "<message for people>"}` with a fitting status code. The web app shows that message as-is.
- Saved recipes expire **one hour after they are first saved**. Updates don't extend that.

## Endpoints

| Method | Path | What it does | Rate limit (per IP) |
| --- | --- | --- | --- |
| `POST` | `/api/process` | Audio in, recipe draft out. Add `?stream=true` for progress events. | 10 per hour |
| `POST` | `/api/recipes` | Save a draft and get share links. | 60 per hour (shared with PUT) |
| `GET` | `/api/recipes/{slug}` | Fetch a saved recipe. | – |
| `PUT` | `/api/recipes/{slug}` | Replace a saved recipe's content. | 60 per hour (shared with POST) |
| `GET` | `/api/recipes/{slug}/crumb` | Download as a Crouton `.crumb` file. | – |
| `GET` | `/api/recipes/{slug}/md` | Download as Markdown. | – |
| `GET` | `/r/{slug}` | Public HTML page for a saved recipe. | – |
| `GET` | `/health` | `{"ok": true}` | – |

Rate limits are kept in memory per process, so on a serverless host they are approximate.

## Process audio

```bash
curl -F audio=@khatti-dal.m4a http://localhost:3000/api/process
```

The form field is `audio`. Accepted: MP3, M4A/MP4, MPEG, WAV, OGG, FLAC and WebM, up to `MAX_AUDIO_MB` (50 MB locally; 4 MB on Vercel, where request bodies are capped at 4.5 MB).

**200** returns the draft. It is shortened here:

```json
{
  "draft": {
    "sourceLanguage": "Hindi",
    "originalTranscript": "सबसे पहले कड़ाही में दो बड़े चम्मच तेल ग…",
    "englishTranscript": "Heat two tablespoons of oil in a pan. Ad…",
    "name": "Aloo Gobi",
    "description": "A comforting cauliflower and potato curry with warming spices.",
    "servings": 4,
    "prepMinutes": 15,
    "cookMinutes": 25,
    "ingredients": [
      {
        "id": "f7c55cc6-20cb-46cf-9cde-54b023691fa7",
        "quantity": "2 tablespoons",
        "amount": 2.0,
        "unit": "TABLESPOON",
        "name": "vegetable oil",
        "uncertain": false
      }
    ],
    "steps": [
      {
        "id": "090cea7a-c473-4f49-a1f2-bb6328fce555",
        "text": "Heat the oil in a large pan. Add the cumin seeds and let them sizzle.",
        "uncertain": false
      }
    ],
    "notes": []
  }
}
```

Field notes:

- `quantity` is the text people read ("1.5 katori", "to taste"). `amount` and `unit` are what Crouton imports. `amount` is `null` when no number was spoken.
- `unit` is one of `ITEM`, `CUP`, `TABLESPOON`, `TEASPOON`, `OUNCE`, `POUND`, `GRAM`, `KILOGRAM`, `MILLILITER`, `LITER`.
- `uncertain: true` marks a row the model wasn't sure about. The web app shows it as "check".
- `servings`, `prepMinutes` and `cookMinutes` are `null` unless they were said.

### Streaming events

With `?stream=true` the response is `application/x-ndjson`: one JSON object per line, ending with a `draft` or an `error`. Validation problems (wrong file type, too large, rate limited) are still plain JSON errors returned before the stream starts.

```text
{"event": "plan", "stages": ["transcribe", "extract"]}
{"event": "stage", "name": "transcribe", "status": "start"}
{"event": "stage", "name": "transcribe", "status": "done", "seconds": 5.3}
{"event": "transcript", "sourceLanguage": "Hindi and English", "originalTranscript": "…", "englishTranscript": "…"}
{"event": "stage", "name": "extract", "status": "start"}
{"event": "stage", "name": "extract", "status": "done", "seconds": 3.1}
{"event": "draft", "draft": { … same as above … }}
```

| Event | When |
| --- | --- |
| `plan` | First. The stages the configured strategy will run: `["single"]`, `["transcribe", "extract"]` or `["transcribe", "extract", "verify"]`. |
| `stage` | Each model call starting (`status: "start"`) and finishing (`"done"`, with `seconds`). A call retried after a rate limit sends `start` again. |
| `transcript` | Right after the transcribe stage, for the strategies that have one. |
| `draft` | Last, on success. |
| `error` | Last, on failure: `{"event": "error", "error": "…", "status": 429}`. |

## Save and share

```bash
curl -X POST http://localhost:3000/api/recipes \
  -H 'content-type: application/json' \
  -d @draft.json            # the "draft" object from /api/process, edited or not
```

**201**:

```json
{
  "recipe": {
    "…": "the draft's fields, plus:",
    "slug": "nXMO5psS_Hgn",
    "uuid": "032cd9b4-b413-475b-a8f6-d3db8ec83c56",
    "createdAt": "2026-10-04T09:59:16.982907Z",
    "updatedAt": "2026-10-04T09:59:16.982907Z",
    "expiresAt": "2026-10-04T10:59:16.982907Z"
  },
  "url": "https://rcpy.vercel.app/r/nXMO5psS_Hgn",
  "crumbUrl": "https://rcpy.vercel.app/api/recipes/nXMO5psS_Hgn/crumb",
  "markdownUrl": "https://rcpy.vercel.app/api/recipes/nXMO5psS_Hgn/md"
}
```

`PUT /api/recipes/{slug}` takes the same body and returns the same shape, keeping the slug and expiry. Links are built from `PUBLIC_BASE_URL` if it's set, otherwise from the request's own host.

## Errors

| Status | Example `error` | Cause |
| --- | --- | --- |
| 400 | `Use an MP3, M4A, WAV, MP4, OGG, FLAC, or WebM audio file.` | Wrong file type or missing `audio` field. |
| 404 | `Recipe not found.` | Unknown or expired slug. `/r/{slug}` shows an HTML page explaining that links expire instead. |
| 400 | `Audio files must be 50 MB or smaller.` | Over `MAX_AUDIO_MB`. On Vercel, files over 4.5 MB are rejected by the platform with a 413 before reaching the engine. |
| 422 | `dal.m4a: the recipe could not be structured. Try a clearer recording.` | The model's reply didn't match the schema. |
| 429 | `RCPY is getting more requests than it can handle right now. Please try again in a few minutes.` | RCPY's own rate limit, or Gemini's quota after retries. |
| 502 / 503 | `The AI service is overloaded right now. Please try again in a minute.` | Gemini errors or network failures. |
| 503 | `GEMINI_API_KEY is not set…` | Server misconfigured. |
