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


def test_schema_is_accepted_by_the_gemini_sdk():
    """The SDK converts our models into its own (stricter) schema format and
    rejects some JSON-schema keywords such as exclusiveMinimum. Catch that
    offline instead of on the first real API call."""
    from google import genai
    from google.genai import _transformers

    client = genai.Client(api_key="test")
    _transformers.t_schema(client._api_client, ParseResult)
