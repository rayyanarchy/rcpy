"""The dictation scripts in evals/scripts are test data: check they stay consistent."""

from pathlib import Path

import pytest

from rcpy.evals.match import tokens
from rcpy.evals.scripts import load_scripts, match_recording

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "evals" / "scripts"
SCRIPTS = load_scripts(SCRIPTS_DIR)


def test_there_are_scripts_with_unique_ids_matching_file_names():
    assert len(SCRIPTS) >= 30
    for script_id in SCRIPTS:
        assert (SCRIPTS_DIR / f"{script_id}.md").is_file()


@pytest.mark.parametrize("script", SCRIPTS.values(), ids=list(SCRIPTS))
def test_every_gold_ingredient_is_actually_said(script):
    said = tokens(script.text)
    for ingredient in script.recipe.ingredients:
        names = [ingredient.name, *ingredient.aliases]
        assert any(tokens(n) and tokens(n) <= said for n in names), f"{script.id}: {ingredient.name} is never said"


def test_about_a_third_of_scripts_are_held_out():
    held_out = sum("holdout" in s.tags for s in SCRIPTS.values())
    assert len(SCRIPTS) // 4 <= held_out <= len(SCRIPTS) // 2


def test_recording_names_map_to_scripts():
    assert match_recording("Khatti-Dal--Mom") == ("khatti-dal", "mom")
    assert match_recording("poha") == ("poha", None)
