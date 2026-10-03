"""Score one prediction against its gold recipe, and roll scores up into a report."""

import re
import statistics
from dataclasses import asdict, dataclass, field, fields

from rcpy.evals.gold import GoldRecipe
from rcpy.evals.match import SYNONYMS, align, name_similarity, quantity_correct, tokens
from rcpy.schema import Recipe

# Function words that carry no cooking content, for the step-coverage metric.
STOPWORDS = set(
    [
        "a",
        "about",
        "after",
        "again",
        "all",
        "also",
        "an",
        "and",
        "any",
        "are",
        "as",
        "at",
        "be",
        "been",
        "before",
        "being",
        "but",
        "by",
        "can",
        "do",
        "does",
        "each",
        "for",
        "from",
        "further",
        "has",
        "have",
        "if",
        "in",
        "into",
        "is",
        "it",
        "its",
        "just",
        "let",
        "more",
        "most",
        "much",
        "no",
        "not",
        "now",
        "of",
        "off",
        "on",
        "once",
        "only",
        "or",
        "other",
        "our",
        "out",
        "over",
        "own",
        "same",
        "should",
        "so",
        "some",
        "such",
        "than",
        "that",
        "the",
        "their",
        "them",
        "then",
        "there",
        "these",
        "they",
        "this",
        "those",
        "through",
        "to",
        "too",
        "until",
        "up",
        "very",
        "was",
        "we",
        "well",
        "were",
        "what",
        "when",
        "where",
        "which",
        "while",
        "will",
        "with",
        "you",
        "your",
        "i",
        "me",
        "my",
        "he",
        "she",
        "his",
        "her",
        "us",
        "one",
    ]
)

WORD_RE = re.compile(r"[a-z]+")


def _content_words(text: str) -> set[str]:
    words = set()
    for w in WORD_RE.findall(text.lower()):
        if w in STOPWORDS or len(w) < 3:
            continue
        w = w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w
        words.add(SYNONYMS.get(w, w))
    return words


@dataclass
class CaseScore:
    """Raw counts for one prediction. Counts (not ratios) so they can be summed across cases."""

    case_id: str
    error: str | None = None
    gold_ingredients: int = 0
    pred_ingredients: int = 0
    matched_ingredients: int = 0
    correct_quantities: int = 0  # among matched
    gold_step_words: int = 0
    pred_step_words: int = 0
    shared_step_words: int = 0
    gold_steps: int = 0
    pred_steps: int = 0
    meta_fields: int = 0  # servings/prep/cook where gold or prediction has a value
    meta_correct: int = 0
    meta_invented: int = 0  # prediction has a value the audio never gave
    title_similarity: float = 0.0
    flagged_wrong: int = 0  # wrong ingredient (bad quantity or not in gold) marked uncertain
    unflagged_wrong: int = 0
    flagged_right: int = 0
    missing: list[str] = field(default_factory=list)
    extra: list[str] = field(default_factory=list)
    wrong_quantity: list[str] = field(default_factory=list)


# Plain water is left out of ingredient scoring on both sides: whether a model lists
# "water" or "water for soaking" says nothing about how well it read the recipe.
_WATER_WORDS = {"water", "hot", "warm", "cold", "chilled", "boiling", "lukewarm", "plain", "garam", "salted", "boiled"}


def _is_water(name: str) -> bool:
    # Judge the name before its purpose: "hot water for soaking tamarind" is water.
    head = re.split(r"\s+(?:for|to)\s+|[,(]", name, maxsplit=1)[0]
    words = tokens(head)
    return "water" in words and words <= _WATER_WORDS


def score_case(case_id: str, gold: GoldRecipe, pred: Recipe | None, error: str | None = None) -> CaseScore:
    gold = gold.model_copy(update={"ingredients": [g for g in gold.ingredients if not _is_water(g.name)]})
    if pred is not None:
        pred = pred.model_copy(update={"ingredients": [p for p in pred.ingredients if not _is_water(p.name)]})
    s = CaseScore(case_id=case_id, error=error, gold_ingredients=len(gold.ingredients), gold_steps=len(gold.steps))
    gold_words = set().union(*(_content_words(t) for t in gold.steps))
    s.gold_step_words = len(gold_words)
    if pred is None:
        s.missing = [g.name for g in gold.ingredients]
        return s

    s.pred_ingredients = len(pred.ingredients)
    s.pred_steps = len(pred.steps)
    pairs = align([[g.name, *g.aliases] for g in gold.ingredients], [p.name for p in pred.ingredients])
    s.matched_ingredients = len(pairs)
    matched_g = {gi for gi, _, _ in pairs}
    matched_p = {pi for _, pi, _ in pairs}

    for gi, pi, _ in pairs:
        g, p = gold.ingredients[gi], pred.ingredients[pi]
        ok = quantity_correct(g.amount, g.amount_max, g.unit, p.amount, p.unit, g.vague)
        if ok:
            s.correct_quantities += 1
            s.flagged_right += p.uncertain
        else:
            s.wrong_quantity.append(
                f"{g.name}: expected {_fmt(g.amount, g.amount_max, g.unit)}, got {_fmt(p.amount, None, p.unit)}"
            )
            if p.uncertain:
                s.flagged_wrong += 1
            else:
                s.unflagged_wrong += 1
    for pi, p in enumerate(pred.ingredients):
        if pi not in matched_p:
            s.extra.append(p.name)
            if p.uncertain:
                s.flagged_wrong += 1
            else:
                s.unflagged_wrong += 1
    s.missing = [g.name for gi, g in enumerate(gold.ingredients) if gi not in matched_g]

    pred_words = set().union(*(_content_words(st.text) for st in pred.steps))
    s.pred_step_words = len(pred_words)
    s.shared_step_words = len(gold_words & pred_words)

    for attr in ("servings", "prep_minutes", "cook_minutes"):
        g, p = getattr(gold, attr), getattr(pred, attr)
        if g is None and p is None:
            continue
        s.meta_fields += 1
        s.meta_correct += g == p
        s.meta_invented += g is None and p is not None

    s.title_similarity = name_similarity(gold.name, pred.name)
    return s


def _fmt(amount: float | None, amount_max: float | None, unit) -> str:
    if amount is None:
        return "no amount"
    value = f"{amount:g}" if amount_max is None else f"{amount:g}-{amount_max:g}"
    return f"{value} {unit.value.lower()}"


def _ratio(num: float, den: float) -> float | None:
    return num / den if den else None


def summarize(scores: list[CaseScore]) -> dict[str, float | None]:
    """Micro-averaged metrics over a set of predictions (every ingredient weighs the same)."""
    t = {f.name: sum(getattr(s, f.name) for s in scores) for f in fields(CaseScore) if f.type in (int, "int")}
    precision = _ratio(t["matched_ingredients"], t["pred_ingredients"])
    recall = _ratio(t["matched_ingredients"], t["gold_ingredients"])
    f1 = 2 * precision * recall / (precision + recall) if precision and recall else 0.0
    wrong = t["flagged_wrong"] + t["unflagged_wrong"]
    return {
        "ingredient_precision": precision,
        "ingredient_recall": recall,
        "ingredient_f1": f1,
        "quantity_accuracy": _ratio(t["correct_quantities"], t["matched_ingredients"]),
        # End to end: gold ingredients that were found *and* got the right quantity.
        "ingredient_exact": _ratio(t["correct_quantities"], t["gold_ingredients"]),
        "step_recall": _ratio(t["shared_step_words"], t["gold_step_words"]),
        "step_precision": _ratio(t["shared_step_words"], t["pred_step_words"]),
        "metadata_accuracy": _ratio(t["meta_correct"], t["meta_fields"]),
        "metadata_invented": t["meta_invented"],
        "uncertain_recall": _ratio(t["flagged_wrong"], wrong),
        "uncertain_precision": _ratio(t["flagged_wrong"], t["flagged_wrong"] + t["flagged_right"]),
        "title_similarity": statistics.fmean(s.title_similarity for s in scores) if scores else None,
        "error_rate": _ratio(sum(s.error is not None for s in scores), len(scores)),
    }


def spread(per_repeat: list[dict[str, float | None]]) -> dict[str, float | None]:
    """Standard deviation of each metric across repeated runs (model nondeterminism)."""
    if len(per_repeat) < 2:
        return {}
    out = {}
    for key in per_repeat[0]:
        values = [r[key] for r in per_repeat if r[key] is not None]
        out[key] = statistics.stdev(values) if len(values) >= 2 else None
    return out


def case_dict(score: CaseScore) -> dict:
    return asdict(score)
