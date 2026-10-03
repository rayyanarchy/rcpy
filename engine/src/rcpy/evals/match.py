"""Fuzzy ingredient matching and quantity comparison.

Deterministic on purpose: the same prediction always gets the same score, so a
change in the numbers means the strategy changed, not the judge.
"""

import re
from difflib import SequenceMatcher

from rcpy.schema import Unit

# Words that describe preparation or are filler, not the ingredient itself.
IGNORED = {
    "a",
    "an",
    "and",
    "any",
    "as",
    "at",
    "for",
    "fresh",
    "freshly",
    "few",
    "into",
    "little",
    "of",
    "or",
    "some",
    "the",
    "to",
    "with",
    "about",
    "approximately",
    "optional",
    "needed",
    "taste",
    "extra",
    "chopped",
    "finely",
    "roughly",
    "diced",
    "cubed",
    "minced",
    "sliced",
    "grated",
    "crushed",
    "peeled",
    "cut",
    "florets",
    "pieces",
    "piece",
    "halved",
    "washed",
    "soaked",
    "boiled",
    "frying",
    "fried",
    "garnish",
    "garnishing",
    "divided",
    "coating",
    "temperature",
    "room",
    "large",
    "small",
    "medium",
    "whole",
    "coarsely",
    "thinly",
    "thickly",
    "cleaned",
    "trimmed",
    # Form words: "cumin seeds" vs "mustard seeds" must not match on "seeds" alone.
    "seed",
    "seeds",
    "powder",
    "ground",
    "paste",
}

# Hindustani (Hindi/Urdu) ingredient words -> the English token they stand for.
# Keeps "haldi" and "turmeric" from counting as different ingredients.
SYNONYMS = {
    "aloo": "potato",
    "alu": "potato",
    "gobi": "cauliflower",
    "gobhi": "cauliflower",
    "pyaz": "onion",
    "pyaaz": "onion",
    "piyaz": "onion",
    "tamatar": "tomato",
    "adrak": "ginger",
    "lasun": "garlic",
    "lahsun": "garlic",
    "lehsun": "garlic",
    "lassan": "garlic",
    "haldi": "turmeric",
    "jeera": "cumin",
    "zeera": "cumin",
    "rai": "mustard",
    "sarson": "mustard",
    "dhania": "coriander",
    "dhaniya": "coriander",
    "kothimeer": "coriander",
    "cilantro": "coriander",
    "mirch": "chili",
    "mirchein": "chili",
    "mirchen": "chili",
    "mirchi": "chili",
    "chilli": "chili",
    "chilly": "chili",
    "chile": "chili",
    "namak": "salt",
    "tel": "oil",
    "cheeni": "sugar",
    "chini": "sugar",
    "dahi": "yogurt",
    "yoghurt": "yogurt",
    "curd": "yogurt",
    "pudina": "mint",
    "methi": "fenugreek",
    "kadi": "curry",
    "kadhi": "curry",
    "karipatta": "curry",
    "patta": "leaf",
    "patte": "leaf",
    "leaves": "leaf",
    "chawal": "rice",
    "atta": "flour",
    "maida": "flour",
    "besan": "gram",
    "elaichi": "cardamom",
    "dalchini": "cinnamon",
    "laung": "clove",
    "cloves": "clove",
    "imli": "tamarind",
    "nimbu": "lemon",
    "limbu": "lemon",
    "anda": "egg",
    "ande": "egg",
    "murgh": "chicken",
    "murgi": "chicken",
    "gosht": "mutton",
    "doodh": "milk",
    "makhan": "butter",
    "paani": "water",
    "pani": "water",
    "hing": "asafoetida",
    "kasuri": "fenugreek",
}

TOKEN_RE = re.compile(r"[a-z]+")


def _singular(word: str) -> str:
    if len(word) > 4 and word.endswith(("oes", "ies")):
        return word[:-2]  # potatoes, tomatoes, chillies -> chilli, chilies -> chili
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def _token_list(name: str) -> list[str]:
    out = []
    for word in TOKEN_RE.findall(name.lower()):
        word = SYNONYMS.get(word, word)
        if word in IGNORED:
            continue
        out.append(SYNONYMS.get(_singular(word), _singular(word)))
    return out


def tokens(name: str) -> set[str]:
    return set(_token_list(name))


def _join_compounds(words: list[str], other: set[str]) -> set[str]:
    """Merge adjacent words that the other name writes as one ("bread crumb" vs "breadcrumb")."""
    out, i = [], 0
    while i < len(words):
        if i + 1 < len(words) and words[i] + words[i + 1] in other:
            out.append(words[i] + words[i + 1])
            i += 2
        else:
            out.append(words[i])
            i += 1
    return set(out)


def _token_match(a: str, b: str) -> bool:
    return a == b or (min(len(a), len(b)) >= 4 and SequenceMatcher(None, a, b).ratio() >= 0.85)


def name_similarity(a: str, b: str) -> float:
    """Dice coefficient over ingredient tokens, tolerant of small spelling differences."""
    la, lb = _token_list(a), _token_list(b)
    ta, tb = _join_compounds(la, set(lb)), _join_compounds(lb, set(la))
    if not ta or not tb:
        return 0.0
    hits = sum(1 for x in ta if any(_token_match(x, y) for y in tb))
    return 2 * hits / (len(ta) + len(tb))


MATCH_THRESHOLD = 0.5


_NOTE = re.compile(r"\(([^)]*)\)")


def name_variants(name: str) -> list[str]:
    """A predicted name plus its core, without the preparation notes models append:
    "large green chillies, slit and seeded" -> also "large green chillies";
    "tahini (sesame paste)" -> also "tahini" and "sesame paste"."""
    core = re.split(r"[,(]", name, maxsplit=1)[0].strip()
    return list(dict.fromkeys(v for v in (name, core, *_NOTE.findall(name)) if v.strip()))


def align(gold_names: list[list[str]], pred_names: list[str]) -> list[tuple[int, int, float]]:
    """Pair gold and predicted ingredients one-to-one, best matches first.

    `gold_names[i]` is the gold name followed by its aliases. Returns
    (gold_index, pred_index, similarity) for each pair at or above the threshold.
    Greedy by similarity is optimal enough here: lists are short and real
    near-ties are rare.
    """
    scored = []
    for gi, names in enumerate(gold_names):
        for pi, pred in enumerate(pred_names):
            sim = max(name_similarity(n, v) for n in names for v in name_variants(pred))
            if sim >= MATCH_THRESHOLD:
                scored.append((sim, gi, pi))
    scored.sort(key=lambda t: (-t[0], t[1], t[2]))
    used_g, used_p, pairs = set(), set(), []
    for sim, gi, pi in scored:
        if gi not in used_g and pi not in used_p:
            used_g.add(gi)
            used_p.add(pi)
            pairs.append((gi, pi, sim))
    return sorted(pairs)


# Units converted to a base unit per dimension, so "half a kilo" == "500 grams".
_BASE = {
    Unit.GRAM: ("mass", 1.0),
    Unit.KILOGRAM: ("mass", 1000.0),
    Unit.OUNCE: ("mass", 28.3495),
    Unit.POUND: ("mass", 453.592),
    Unit.MILLILITER: ("volume", 1.0),
    Unit.LITER: ("volume", 1000.0),
    Unit.TEASPOON: ("volume", 4.92892),
    Unit.TABLESPOON: ("volume", 14.7868),
    Unit.CUP: ("volume", 236.588),
    Unit.ITEM: ("count", 1.0),
}

TOLERANCE = 0.03  # relative; absorbs rounding in conversions like 1 lb -> 450 g


def quantity_correct(
    gold_amount: float | None,
    gold_max: float | None,
    gold_unit: Unit,
    amount: float | None,
    unit: Unit,
    vague: bool = False,
) -> bool:
    """Is the predicted quantity equivalent to the gold one?

    No spoken amount must stay null (not invented). A spoken range accepts any
    value inside it. A vague measure ("2 katori", "a pinch") has no real unit,
    so only the number is checked, and leaving it empty is also accepted.
    """
    if vague and gold_amount is not None:
        if amount is None:
            return True
        high = gold_max if gold_max is not None else gold_amount
        return gold_amount * (1 - TOLERANCE) <= amount <= high * (1 + TOLERANCE)
    if gold_amount is None or amount is None:
        return gold_amount is None and amount is None
    g_dim, g_factor = _BASE[gold_unit]
    p_dim, p_factor = _BASE[unit]
    if g_dim != p_dim:
        return False
    low = gold_amount * g_factor
    high = (gold_max if gold_max is not None else gold_amount) * g_factor
    value = amount * p_factor
    return low * (1 - TOLERANCE) <= value <= high * (1 + TOLERANCE)
