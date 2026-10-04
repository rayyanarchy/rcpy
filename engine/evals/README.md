# Evals

These evals measure how accurately each parse strategy turns a recording into a recipe. The recordings and their correct answers ("gold") stay in `engine/data/evals/`, which is git-ignored because the audio is private. Run summaries are written here, to `results/`, and are committed so the numbers can be published.

## Workflow

Run these from `engine/`.

```bash
uv run rcpy eval add ~/Recordings/*.m4a       # one case per file, with gold.json pre-filled by the model
# correct each data/evals/cases/<id>/gold.json by hand, then set "reviewed": true
uv run rcpy eval list                         # which cases are reviewed
uv run rcpy eval run -s single -n 3           # 3 repeats per case to measure variance
uv run rcpy eval run -s staged -n 3
uv run rcpy eval compare                      # every saved run side by side
uv run rcpy eval compare --markdown           # the same, as a table for the README
uv run rcpy eval rescore <run_id>             # re-grade cached predictions after fixing a gold file
uv run rcpy eval resume <run_id>              # redo only the predictions that failed (rate limits)
uv run rcpy eval sync                         # copy edited script answer keys into recorded cases
```

Only reviewed cases are used unless you pass `--include-unreviewed`. Scores against unreviewed drafts are biased toward whichever strategy wrote the draft, so don't report them.

## Recording the dataset

The main set is **[36 dictation scripts](scripts/README.md)**, read aloud by three people. Each script carries its own answer key, so a recording named after its script (`khatti-dal.m4a`) is scored with no labelling. The scripts deliberately include the things models get wrong: self-corrections, ranges, vague amounts, desi measures (*pav*, *katori*, *chammach*), ingredients only mentioned inside a step, forgotten-then-added ingredients, explicitly excluded ones, and times or servings that are sometimes said and sometimes not.

Unscripted recordings work too: add them with `rcpy eval add`, which drafts a `gold.json` for you to correct (below). Tag them `freestyle`, so results can be split between read and spontaneous speech.

**Hold-out set:** about a third of the scripts are tagged `holdout`. Don't read their failures while tuning prompts. The holdout numbers (`by_tag.holdout` in each summary) are the headline result, since the other cases are the ones prompts were tuned on.

## Writing gold.json

Listen to the whole recording while you edit the draft. The draft comes from a model, and it is easy to just agree with it.

```json
{
  "id": "chatpate-aloo",
  "reviewed": true,
  "language": "hi-en",
  "speaker": "mum",
  "tags": ["mixed", "ranges", "vague"],
  "notes": "",
  "recipe": {
    "name": "Chatpate Aloo",
    "servings": null,
    "prep_minutes": null,
    "cook_minutes": null,
    "ingredients": [
      {"name": "potatoes", "aliases": ["aloo"], "amount": 0.5, "unit": "KILOGRAM"},
      {"name": "garlic cloves", "aliases": ["lasun"], "amount": 15, "amount_max": 20, "unit": "ITEM"},
      {"name": "turmeric powder", "aliases": ["haldi"], "amount": null, "unit": "ITEM"}
    ],
    "steps": [
      "Cut the potatoes and soak them in water for a while.",
      "Crush the garlic and cumin coarsely in a grinder."
    ]
  }
}
```

The rules follow what the metrics check:

- **One entry per ingredient**, even if it's used twice ("salt" once, not "salt for the batter" and "salt for the egg"). Include ingredients that only come up inside a step.
- **name** is the plain English name without prep words ("onion", not "onion, finely chopped"). Put Hindi/Urdu names and spellings in **aliases**. Matching is fuzzy and already knows common words like haldi, jeera and kothimeer, but aliases make it certain.
- **amount and unit are exactly what was spoken.** Don't convert: "adha kilo" is 0.5 KILOGRAM. The scorer accepts any equivalent answer, so a prediction of 500 GRAM also counts as correct. For a range, put the low value in `amount` and the high value in `amount_max`. If no number was spoken ("to taste", "thoda"), set `amount` to `null`. A prediction that invents a number then counts as wrong.
- **Vague measures** ("2 katori", "a glass", "a handful", "ek chutki", "a pinch", "a cube") are the spoken number with unit `ITEM` and `"vague": true`. For these only the number is scored: "dedh katori" predicted as 1.5 cups is right, and leaving the amount empty is also accepted. Without a count or "a" ("chutki bhar", "thoda sa") the amount is `null`. A size comparison ("imli, nimbu ke barabar") is also `null`.
- **An ingredient used twice** is one entry, with the amount that was actually said ("thoda butter" and later "1 tablespoon butter" is butter, 1 TABLESPOON).
- **Explicitly excluded** ingredients ("piyaz nahi daalte") are not listed.
- **Plain water** ("teen glass paani", "water for soaking") is left out. The scorer ignores it on both sides. Flavoured liquids such as tamarind water or stock do count.
- **servings, prep_minutes and cook_minutes** are only filled in when they were actually said. Filling them in otherwise counts as invented.
- **steps** cover every spoken instruction, in order, in plain English. The wording doesn't have to match the model's, because the step metrics compare content words (ingredients, actions, times) rather than whole sentences.
- Set **reviewed** to `true` only after checking every field against the audio.

## Metrics

| Metric | What it measures |
| --- | --- |
| Ingredient precision / recall / F1 | Were the right ingredients found? Precision is lowered by invented ingredients, recall by missed ones. |
| Quantity accuracy | Of the matched ingredients, how many have an amount and unit equivalent to the gold? Units are compared by conversion within 3%. |
| Ingredient exact | End to end: the share of gold ingredients that were found *and* given the right quantity. |
| Step coverage / precision | How much of the gold steps' content vocabulary appears in the predicted steps, and the reverse. This is a lexical proxy, so paraphrasing costs a few points. |
| Servings/times accuracy, invented | Metadata correctness, plus how often a value was made up. |
| Errors flagged uncertain | Of the wrong ingredients, the share the model marked `uncertain`. This shows whether the review UI highlights the right rows. |
| Latency, tokens, cost | Per recipe, across all stages. Costs need prices in `pricing.json`. |

With `-n` greater than 1, each percentage shows ± one standard deviation across the repeats.

## Scoring changes

Scoring rules are part of the result, so changes are listed here. Every change is applied to every run by `rcpy eval rescore`, from cached predictions.

- **v2 (2026-10-03, after the first full run on the scripted set).** Reading the errors showed most "wrong" answers were scoring bugs, not model mistakes:
  - Predicted names carry preparation notes ("large green chillies, thick and less spicy, slit and seeded"), which pushed the similarity below the threshold. Matching now also tries the name without its notes and the words in brackets.
  - "chillies" and "chilies" didn't reduce to the same word; `-ies` plurals are now handled.
  - Vague measures demanded unit `ITEM`, so "1.5 katori" predicted as 1.5 cups was wrong, even though the web app itself maps katori to cups. Gold rows now carry `vague`, and only the number is scored.
  - "Hot water for soaking tamarind" wasn't recognised as plain water. The name before "for"/"to" is checked now.
  - Two answer keys were wrong (salt in the aloo paratha dough is half a teaspoon; pasta water is an ingredient in the desi pasta).

  Effect on the first `single` run: ingredient F1 rose from 97.1% to 99.0%, and quantity accuracy from 90.6% to 95.8%. Rankings between strategies didn't change.

## Prompt changes

- **Extract v2 (2026-10-04).** Imports into Crouton showed spelled-out quantities ("five hundred ml", "a whole capsicum" with no amount). The extract prompt now asks for recipe-card quantities with digits ("500 ml", "1"), counts "a", "one" and "a whole" as 1, and keeps amounts out of names. Code also rewrites any quantity that still has no digits from its amount and unit. Rerun `20261004-150611-staged-lite` against v1 `20261003-192916-staged-lite`: quantities without digits went from 350 of 1,138 to 0, made-up servings or times 54 → 52, and right ingredient and amount 97.5% → 96.7%. Most of the new misses happened in only one of the three repeats. The display fix was worth the small cost; the published numbers are v2's.
