# ADR-0001: Where the eval recordings and their answers come from

**Status:** Accepted (revised from the proposal the same day; see Decision)
**Date:** 2026-10-03
**Deciders:** Rayyan

## Context

The pipeline comparison (single vs staged vs staged-lite) needs recordings plus a correct answer for each one ("gold"). The plan was 20–50 of our own family dictations. What exists today:

- **30 YouTube cooking videos**, downloaded as 16 kHz mono WAV (`~/Downloads/rcpy-eval-data/yfl/`). They run 7.6 to 44.8 minutes (median 12, about 7 hours in total) and take 14–97 MB each. They are messy in the useful ways: Hindi/Urdu/English mixing, background music, people talking over each other, amounts said casually.
- **No own recordings yet.**

Facts that shape the decision:

1. **The 4 MB limit is not in the eval path.** It exists only in the Vercel build of the web app, because Vercel caps request bodies at 4.5 MB. `rcpy eval run` calls the engine directly on this machine, where the only limit is `MAX_AUDIO_MB` (50 MB by default), and Gemini's Files API accepts files far larger than that. The real obstacle is that the WAVs are uncompressed: the 45-minute file is 97 MB. Speech compressed to Opus at 32 kbps takes about 0.25 MB a minute, which brings even that file to around 11 MB.
2. **These videos are a different kind of audio from what the product receives.** RCPY's users dictate a recipe in 1–5 minutes. A cooking video is 8–45 minutes of narration, digressions, intros, sponsor reads and music, edited for watching. A model that does well on videos will probably do well on dictations, but the reverse isn't guaranteed, and the numbers aren't interchangeable.
3. **Labelling cost grows with length.** Checking gold for a 12-minute video means watching 12 minutes. Thirty videos is about 7 hours of watching before any review.
4. **Rights.** The audio belongs to the channels. Using it privately to measure our own software is a common research practice, but it isn't ours to publish. (This is a practical note, not legal advice.)

## Decision

**Option E: scripted family dictations.** Thirty-six recipes are written to be read aloud ([`engine/evals/scripts/`](../../engine/evals/scripts/README.md)), with the human errors built in, and read by three people: Mom (mostly Urdu/Hindi), Sister (Hinglish) and Rayyan (English with desi words). Each script carries its own answer key, so a recording named after its script is a scored case with no labelling.

1. **The 4 MB limit stays.** It isn't in the eval path. Phone voice memos are compressed and short, so no transcoding step is needed either.
2. **The YouTube videos are not used.** Their format (long, edited narration) isn't what the product receives, and the audio isn't ours to build on. Nothing from them enters the repo.
3. **The gold is written before any model sees the audio**, so it can't lean toward whichever strategy would have drafted it.
4. **The bias that comes with scripts is known and tracked.** Read speech is more fluent than spontaneous speech, and the corrections are performed rather than natural. Every scripted case carries the `scripted` tag. A few unscripted recordings of dishes the family really cooks, tagged `freestyle` and labelled by hand, give a check on how far the scripted numbers carry over.
5. **A third of the scripts are `holdout`**, four per reader, and are not looked at while tuning prompts.
6. **Synthetic TTS audio is still deferred** (Option C).

## Options Considered

### Option A: YouTube videos as an in-the-wild slice, with gold seeded from descriptions (first proposal, not chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium: a transcode step, a yt-dlp metadata import, per-slice reporting |
| Cost | About 0.8M audio tokens for one strategy's pass over all 30 (32 tokens per second); about 7M for 3 strategies × 3 repeats |
| Realism | High for messy speech, low for the dictation format |
| Labelling effort | Moderate when the description has an ingredient list, high when it doesn't |

**Pros:** available today; genuinely messy; descriptions give gold that is independent of the model for the hardest part (ingredients and amounts); long recordings stress the transcription stage.
**Cons:** not the product's input format; long audio costs more and runs slower; the rights mean these numbers can be described but the material can't be shown; descriptions can disagree with what's spoken, so they are a hint, not the truth.

### Option B: YouTube subtitles as the reference ("key-value data")

| Dimension | Assessment |
| --- | --- |
| Complexity | Low to fetch, medium to use |
| Cost | Free |
| Realism | Depends on who wrote the captions |
| Labelling effort | Doesn't remove it |

**Pros:** creator-uploaded captions could later anchor a transcription-accuracy metric (word or character error rate) for the transcribe stage.
**Cons:** auto-generated captions for Hindi/Urdu-English speech are often poor, so treating them as ground truth would penalise correct output. A transcript is also not a recipe: it says nothing directly about which ingredients and amounts are correct. Used only as reviewer context in `reference.md`, where it's useful but not authoritative.

### Option C: Synthetic audio from written recipes (TTS, "DeepEval-style")

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium: written recipes, a TTS provider, scripted perturbations |
| Cost | TTS fees; gold is free |
| Realism | Low: clean, evenly paced, and Hinglish TTS is still weak |
| Labelling effort | None, since the gold is the script |

**Pros:** exact gold at any scale; precise control over phenomena (insert "two, no, three cups", ranges, *pav kilo*, kitchen noise), which makes it good for regression tests of specific behaviour.
**Cons:** models find synthetic speech easier, so scores would be inflated; it measures our scripts more than real users. Note that DeepEval's synthesizer generates text test cases, not audio, so the audio would come from a separate TTS step either way.
**Use later** as a 10–20 case `synthetic` stress slice aimed at known failure modes, never mixed into the headline.

### Option D: Wait for own recordings only

**Pros:** cleanest story, and it matches the product.
**Cons:** blocks the whole comparison and the results page indefinitely.

### Option E: Scripted dictations with answer keys, read by family (chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Low: a script format, a parser, and matching recordings to scripts by file name |
| Cost | Short audio, about 1–2 minutes each, so a full pass is cheap |
| Realism | High for format and speakers, medium for spontaneity |
| Labelling effort | None, beyond fixing gold where a reader changed an amount |

**Pros:** exactly the product's input (people dictating recipes on a phone, in their own languages); exact gold with no model in the loop; failure modes are planted deliberately and tagged; it's ours to publish, so the scripts themselves can be shown; about an hour of recording.
**Cons:** read speech is cleaner than spontaneous speech; the script writer's idea of a "mistake" may not match real ones; three speakers is a small set of voices.

## Trade-off Analysis

The product is dictation, so the headline numbers have to come from dictation. Scripts give that with exact answers and no labelling, at the cost of some spontaneity. A small `freestyle` slice measures how much that cost is. The YouTube videos would have added noisy speech, but in the wrong format and with material that isn't ours. Synthetic audio stays useful later for targeted regression cases.

## Consequences

- **Easier:** the benchmark can run as soon as the recordings exist; gold is independent of every strategy; the scripts double as documentation of what the system is tested against.
- **Harder:** keeping the answer keys in line with the scoring rules (enforced by `tests/test_scripts.py`, which checks every answer-key ingredient is actually said).
- **Revisit:** if `freestyle` scores differ a lot from `scripted`, collect more unscripted recordings before choosing the default strategy.

## Action Items

1. [x] Write 36 scripts with answer keys, a third of them held out (`engine/evals/scripts/`).
2. [x] `rcpy eval add` takes the answer key from a script when the file is named after one; `rcpy eval scripts` shows what's recorded.
3. [x] Scoring rules: plain water is ignored on both sides; pinch, handful, repeated and excluded ingredients are documented.
4. [ ] Record (Mom, Sister, Rayyan), then `rcpy eval add` and run all three strategies with 3 repeats.
5. [ ] A few `freestyle` recordings, labelled by hand.
6. [ ] Later: the synthetic stress slice.
