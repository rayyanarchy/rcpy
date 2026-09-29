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
