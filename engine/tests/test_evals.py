import json

import pytest
from typer.testing import CliRunner

from rcpy.cli import app
from rcpy.evals.gold import GoldCase, GoldIngredient, GoldRecipe, load_case, save_case
from rcpy.evals.match import align, name_similarity, quantity_correct
from rcpy.evals.metrics import score_case, summarize
from rcpy.schema import Unit

runner = CliRunner()


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("garlic cloves", "lasun"),
        ("cilantro, finely chopped", "kothimeer"),
        ("potatoes, peeled and cubed", "aloo"),
        ("curry leaves", "kadi patta"),
        ("red chilli powder", "red chili powder"),
        ("oil for frying", "vegetable oil"),
        ("bread crumbs for coating", "breadcrumbs"),
    ],
)
def test_same_ingredient_matches(a, b):
    assert name_similarity(a, b) >= 0.5


@pytest.mark.parametrize(
    ("a", "b"),
    [("cumin seeds", "mustard seeds"), ("turmeric powder", "red chili powder"), ("salt", "sugar")],
)
def test_different_ingredients_do_not_match(a, b):
    assert name_similarity(a, b) < 0.5


def test_align_is_one_to_one_and_prefers_best_match():
    gold = [["onion"], ["red onion"]]
    pairs = align(gold, ["red onion, sliced", "onion"])
    assert pairs == [(0, 1, 1.0), (1, 0, 1.0)]


def test_quantity_equivalence():
    assert quantity_correct(0.5, None, Unit.KILOGRAM, 500, Unit.GRAM)  # "adha kilo" == 500 g
    assert quantity_correct(3, None, Unit.TEASPOON, 1, Unit.TABLESPOON)
    assert quantity_correct(15, 20, Unit.ITEM, 18, Unit.ITEM)  # inside a spoken range
    assert not quantity_correct(15, 20, Unit.ITEM, 25, Unit.ITEM)
    assert not quantity_correct(1, None, Unit.CUP, 1, Unit.GRAM)  # volume vs mass
    assert quantity_correct(None, None, Unit.ITEM, None, Unit.ITEM)  # "to taste" stays empty
    assert not quantity_correct(None, None, Unit.ITEM, 1, Unit.TEASPOON)  # invented amount


def _gold() -> GoldRecipe:
    return GoldRecipe(
        name="Aloo Gobi",
        servings=None,
        ingredients=[
            GoldIngredient(name="oil", amount=2, unit=Unit.TABLESPOON),
            GoldIngredient(name="cumin seeds", aliases=["jeera"], amount=1, unit=Unit.TEASPOON),
            GoldIngredient(name="cauliflower", amount=1, unit=Unit.ITEM),
            GoldIngredient(name="ginger", amount=None),
        ],
        steps=["Heat the oil and add cumin seeds.", "Add the cauliflower and cook covered."],
    )


def test_score_case_counts(result):
    score = score_case("aloo-gobi", _gold(), result.recipe)
    # DEMO has oil, cumin, onion, cauliflower, potatoes, salt; gold has no onion/potato/salt, and ginger is missing.
    assert score.matched_ingredients == 3
    assert score.correct_quantities == 3
    assert sorted(score.extra) == ["onion, finely chopped", "potatoes, peeled and cubed", "salt"]
    assert score.missing == ["ginger"]
    assert score.meta_invented == 3  # servings, prep and cook were never spoken
    assert score.flagged_wrong == 1  # salt is extra and marked uncertain
    m = summarize([score])
    assert m["ingredient_precision"] == pytest.approx(3 / 6)
    assert m["ingredient_recall"] == pytest.approx(3 / 4)
    assert m["ingredient_exact"] == pytest.approx(3 / 4)


def test_failed_prediction_scores_zero():
    score = score_case("x", _gold(), None, error="boom")
    m = summarize([score])
    assert m["ingredient_recall"] == 0
    assert m["error_rate"] == 1


def test_eval_cli_end_to_end(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("EVALS_DIR", str(tmp_path / "evals"))
    audio = tmp_path / "Aloo Gobi.m4a"
    audio.write_bytes(b"fake")

    res = runner.invoke(app, ["eval", "add", str(audio)])
    assert res.exit_code == 0, res.output
    case_dir = tmp_path / "data" / "evals" / "cases" / "aloo-gobi"
    assert (case_dir / "audio.m4a").exists()
    assert (case_dir / "transcript.txt").exists()

    res = runner.invoke(app, ["eval", "run"])
    assert res.exit_code == 1
    assert "none are reviewed" in res.output

    case = load_case(case_dir)
    save_case(case_dir, case.model_copy(update={"reviewed": True, "tags": ["hindi"]}))
    res = runner.invoke(app, ["eval", "run", "-n", "2"])
    assert res.exit_code == 0, res.output

    [summary_path] = (tmp_path / "evals" / "results").glob("*.json")
    summary = json.loads(summary_path.read_text())
    # Gold was drafted from the same (demo) prediction, so everything matches.
    assert summary["metrics"]["ingredient_f1"] == 1
    assert summary["metrics"]["quantity_accuracy"] == 1
    assert summary["predictions"] == 2
    assert "hindi" in summary["by_tag"]

    res = runner.invoke(app, ["eval", "rescore", summary["run_id"]])
    assert res.exit_code == 0, res.output
    res = runner.invoke(app, ["eval", "compare", "--markdown"])
    assert "| Ingredient F1 | 100.0% ±0.0 |" in res.output


def test_add_without_bootstrap_writes_template(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    audio = tmp_path / "dal.mp3"
    audio.write_bytes(b"x")
    res = runner.invoke(app, ["eval", "add", str(audio), "--no-bootstrap"])
    assert res.exit_code == 0, res.output
    case = GoldCase.model_validate_json((tmp_path / "data" / "evals" / "cases" / "dal" / "gold.json").read_text())
    assert not case.reviewed
