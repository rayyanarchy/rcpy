# ADR-0001: Where the eval recordings and their answers come from

**Status:** Proposed
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

1. **Leave the 4 MB limit as it is.** Add a preparation step to `rcpy eval add` that transcodes anything that isn't already compressed speech (WAV, FLAC, or anything over 20 MB) to Opus at 32 kbps with ffmpeg before it goes into the case folder.
2. **Use the 30 videos now, as a separate slice tagged `youtube`**, not as the headline. Every result is reported per slice. The results page labels this slice "YouTube cooking videos (in the wild)".
3. **Bootstrap gold from the video's own description, not only from a model.** Many recipe videos list ingredients with amounts in the description. A new `rcpy eval import-youtube links.txt` step uses yt-dlp to fetch metadata only (title, channel, description, and subtitles where the creator uploaded them) into a `reference.md` beside each `gold.json`. Reviewers correct the model draft against both the audio and the description. This lowers the bias toward whichever strategy wrote the draft, and makes ingredient review much faster than watching the whole video.
4. **Prioritise ingredients when reviewing videos.** For `youtube` cases, the ingredients and amounts must be checked against the audio. Steps can be marked `steps_reviewed: false`, and step metrics are reported only for cases where they are true. This keeps the labelling to roughly an hour per ten videos instead of a full watch of each.
5. **Keep own dictations as the headline slice, at a smaller size.** Aim for 10–15 family dictations tagged `dictation`. These match what the product actually receives, and they are the numbers a recruiter should see first. A third of each slice is tagged `holdout`.
6. **Don't publish other people's content.** The audio, transcripts and descriptions stay in git-ignored `data/evals/`. The repo gets aggregate scores and per-case counts. Cases are named by video ID and credited in `engine/evals/SOURCES.md` (channel, title, link). The failure examples on the results page show only ingredient names and amounts, never quoted speech.
7. **Defer synthetic audio.** Revisit it later as a small "stress" slice (see Option C).

## Options Considered

### Option A: YouTube videos as an in-the-wild slice, with gold seeded from descriptions (chosen)

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

## Trade-off Analysis

The data that is realistic (own dictations) doesn't exist yet. The data that exists (videos) is realistic about speech but not about format. The data that is easy to label (synthetic) isn't realistic. Reporting by slice means one doesn't have to choose: the videos unblock the comparison now and show robustness, the dictations carry the headline once recorded, and synthetic cases later pin down specific failure modes. The main risk with the videos is labelling cost, and seeding gold from descriptions plus reviewing ingredients first targets exactly that. The second risk is overclaiming, and that's handled by always naming the slice next to the number.

## Consequences

- **Easier:** the benchmark can run this week; the results page gets real numbers; transcription is tested on long, noisy audio.
- **Harder:** every metric needs a slice next to it; long cases make each run slower and more expensive (use `--jobs` and fewer repeats on this slice).
- **Revisit:** whether to trim videos to the cooking portion; adding a transcription error-rate metric if creator captions turn out to be good; the synthetic stress slice; which strategy is the default once the `dictation` slice exists, since that is the slice the default should be chosen on.

## Action Items

1. [ ] `rcpy eval add`: transcode WAV, FLAC and files over 20 MB to Opus at 32 kbps with ffmpeg; add a `--tag` option.
2. [ ] `rcpy eval import-youtube links.txt --audio-dir …`: match each WAV to its link, fetch metadata and creator subtitles with yt-dlp (`--skip-download`), write `reference.md`, tag the case `youtube`, and add it to `SOURCES.md`.
3. [ ] Gold: add `steps_reviewed` to `GoldCase`; count step metrics only where it is true; update `engine/evals/README.md`.
4. [ ] Reporting: per-slice tables in `rcpy eval compare` and on the results page, with `dictation` first when it exists.
5. [ ] Review the 30 videos' ingredients (Rayyan), tag 10 as `holdout`, and run all three strategies.
6. [ ] Record 10–15 family dictations, tagged `dictation`.
7. [ ] Later: the synthetic stress slice.
