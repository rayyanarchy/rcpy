import pytest
from pydantic import ValidationError

from rcpy.schema import ParseResult


def test_demo_round_trips(result):
    assert ParseResult.model_validate_json(result.model_dump_json()) == result


def test_rejects_unknown_unit(result):
    data = result.model_dump(mode="json")
    data["recipe"]["ingredients"][0]["unit"] = "PINCH"
    with pytest.raises(ValidationError):
        ParseResult.model_validate(data)


def test_requires_ingredients(result):
    data = result.model_dump(mode="json")
    data["recipe"]["ingredients"] = []
    with pytest.raises(ValidationError):
        ParseResult.model_validate(data)
