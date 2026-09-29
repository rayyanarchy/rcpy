import json

from rcpy.formatters import to_html, to_json, to_markdown


def test_json_keeps_non_ascii(result):
    text = to_json(result)
    assert json.loads(text)["recipe"]["name"] == "Aloo Gobi"


def test_markdown_structure(result):
    md = to_markdown(result)
    assert md.startswith("# Aloo Gobi")
    assert "- [ ] 2 tablespoons vegetable oil" in md
    assert "1. Heat the oil" in md
    assert "- [ ] to taste salt _(uncertain)_" in md
    assert "**Total Time:** 40 minutes" in md


def test_html_escapes(result):
    result.recipe.name = "<script>alert(1)</script>"
    html = to_html(result)
    assert "<script>alert" not in html
    assert "&lt;script&gt;" in html


def test_crumb_matches_observed_shape(result):
    from datetime import UTC, datetime

    from rcpy.draft import RecipeDraft, StoredRecipe
    from rcpy.formatters import to_crumb

    now = datetime.now(UTC)
    draft = RecipeDraft.from_result(result)
    stored = StoredRecipe.model_validate(
        {**draft.model_dump(), "slug": "sample_12345", "uuid": "8f14e45f-ceea-467a-9575-1c1c9f2a3b4d",
         "created_at": now, "updated_at": now, "expires_at": now}
    )
    crumb = to_crumb(stored, "https://rcpy.example")

    assert sorted(crumb) == sorted([
        "tags", "cookingDuration", "webLink", "duration", "images", "uuid", "serves", "ingredients",
        "sourceImage", "name", "steps", "folderIDs", "nutritionalInfo", "isPublicRecipe",
        "defaultScale", "sourceName",
    ])
    assert crumb["uuid"] == "8F14E45F-CEEA-467A-9575-1C1C9F2A3B4D"
    assert crumb["sourceName"] == "rcpy.example"
    assert crumb["ingredients"][0]["quantity"] == {"quantityType": "TABLESPOON", "amount": 2}
    # an unspoken amount becomes 1, and the spoken text moves into the name
    assert crumb["ingredients"][5]["quantity"]["amount"] == 1
    assert crumb["ingredients"][5]["ingredient"]["name"] == "salt · to taste"
    assert crumb["steps"][0]["isSection"] is False and crumb["steps"][0]["order"] == 0


def test_shared_page_has_json_ld_and_noindex(result):
    from datetime import UTC, datetime

    from rcpy.formatters import PageInfo

    now = datetime.now(UTC)
    html = to_html(result, PageInfo("https://rcpy.example", "sample_12345", now, now))
    assert 'type="application/ld+json"' in html
    assert '"@type":"Recipe"' in html
    assert 'name="robots" content="noindex, nofollow"' in html
    assert "https://rcpy.example/api/recipes/sample_12345/crumb" in html
