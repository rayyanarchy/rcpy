"""Turn a ParseResult into JSON, Markdown or a standalone HTML page."""

from html import escape

from rcpy.schema import ParseResult

FORMATS = ("json", "md", "html")


def to_json(result: ParseResult) -> str:
    return result.model_dump_json(indent=2) + "\n"


def to_markdown(result: ParseResult) -> str:
    r = result.recipe
    total = (r.prep_minutes or 0) + (r.cook_minutes or 0)

    meta = []
    if r.servings:
        meta.append(f"- **Servings:** {r.servings}")
    if r.prep_minutes is not None:
        meta.append(f"- **Prep Time:** {r.prep_minutes} minutes")
    if r.cook_minutes is not None:
        meta.append(f"- **Cook Time:** {r.cook_minutes} minutes")
    if total > 0:
        meta.append(f"- **Total Time:** {total} minutes")

    flag = " _(uncertain)_"
    ingredients = "\n".join(
        f"- [ ] {' '.join(p for p in (i.quantity, i.name) if p)}{flag if i.uncertain else ''}"
        for i in r.ingredients
    )
    steps = "\n\n".join(
        f"{n}. {s.text}{flag if s.uncertain else ''}" for n, s in enumerate(r.steps, 1)
    )

    parts = [f"# {r.name}"]
    if r.description:
        parts.append(f"> {r.description}")
    if meta:
        parts.append("\n".join(meta))
    parts.append(f"## Ingredients\n\n{ingredients}")
    parts.append(f"## Method\n\n{steps}")
    if r.notes:
        parts.append("## Notes\n\n" + "\n".join(f"- {n}" for n in r.notes))
    parts.append("---\n*Transcribed and formatted with RCPY.*")
    return "\n\n".join(parts) + "\n"


def to_html(result: ParseResult) -> str:
    r = result.recipe
    e = escape
    facts = "".join(
        f"<div><dt>{label}</dt><dd>{value}</dd></div>"
        for label, value in (
            ("Prep", f"{r.prep_minutes} min" if r.prep_minutes is not None else None),
            ("Cook", f"{r.cook_minutes} min" if r.cook_minutes is not None else None),
            ("Serves", r.servings),
        )
        if value is not None
    )
    ingredients = "".join(
        f'<li{" class=uncertain" if i.uncertain else ""}>'
        f'<span class="qty">{e(i.quantity)}</span> {e(i.name)}</li>'
        for i in r.ingredients
    )
    steps = "".join(
        f'<li{" class=uncertain" if s.uncertain else ""}>{e(s.text)}</li>' for s in r.steps
    )
    notes = (
        "<h2>Notes</h2><ul>" + "".join(f"<li>{e(n)}</li>" for n in r.notes) + "</ul>"
        if r.notes
        else ""
    )
    description = f'<p class="desc">{e(r.description)}</p>' if r.description else ""

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(r.name)} - RCPY</title>
<style>
  body {{ font: 16px/1.6 system-ui, sans-serif; color: #26142e; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }}
  h1 {{ font-family: Georgia, serif; margin-bottom: .25rem; }}
  .desc {{ color: #6f6572; }}
  dl {{ display: flex; gap: 2rem; padding: 1rem 0; border-block: 1px solid #e5dfe3; }}
  dt {{ font-size: .75rem; text-transform: uppercase; letter-spacing: .1em; color: #6f6572; }}
  dd {{ margin: 0; font-weight: 600; }}
  .qty {{ color: #d94434; font-weight: 600; }}
  li {{ margin: .4rem 0; }}
  .uncertain {{ background: #fff1ee; }}
  .uncertain::after {{ content: " (uncertain)"; color: #6f6572; font-size: .85em; }}
</style>
</head>
<body>
<h1>{e(r.name)}</h1>
{description}
<dl>{facts}</dl>
<h2>Ingredients</h2>
<ul>{ingredients}</ul>
<h2>Method</h2>
<ol>{steps}</ol>
{notes}
<hr>
<p><small>Transcribed and formatted with RCPY.</small></p>
</body>
</html>
"""


RENDERERS = {"json": to_json, "md": to_markdown, "html": to_html}


def render(result: ParseResult, fmt: str) -> str:
    return RENDERERS[fmt](result)
