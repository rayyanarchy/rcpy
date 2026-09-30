"""Turn a ParseResult into JSON, Markdown or a standalone HTML page."""

import json
import secrets
from dataclasses import dataclass
from datetime import datetime
from html import escape
from urllib.parse import urlparse

from rcpy.draft import StoredRecipe
from rcpy.schema import ParseResult

FORMATS = ("json", "md", "html")


@dataclass
class PageInfo:
    """Extra context for a recipe that has been shared at a public URL."""

    base_url: str
    slug: str
    created_at: datetime
    updated_at: datetime

    @property
    def url(self) -> str:
        return f"{self.base_url}/r/{self.slug}"

    @property
    def markdown_url(self) -> str:
        return f"{self.base_url}/api/recipes/{self.slug}/md"

    @property
    def crumb_url(self) -> str:
        return f"{self.base_url}/api/recipes/{self.slug}/crumb"


def to_json(result: ParseResult) -> str:
    return result.model_dump_json(indent=2) + "\n"


def to_markdown(result: ParseResult, link: str | None = None) -> str:
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
    if link:
        meta.append(f"- **Link:** [{r.name}]({link})")

    flag = " _(uncertain)_"
    ingredients = "\n".join(
        f"- [ ] {' '.join(p for p in (i.quantity, i.name) if p)}{flag if i.uncertain else ''}" for i in r.ingredients
    )
    steps = "\n\n".join(f"{n}. {s.text}{flag if s.uncertain else ''}" for n, s in enumerate(r.steps, 1))

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


def to_html(result: ParseResult, page: PageInfo | None = None) -> str:
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
        f'<li{" class=uncertain" if i.uncertain else ""}><span class="qty">{e(i.quantity)}</span> {e(i.name)}</li>'
        for i in r.ingredients
    )
    steps = "".join(f"<li{' class=uncertain' if s.uncertain else ''}>{e(s.text)}</li>" for s in r.steps)
    notes = "<h2>Notes</h2><ul>" + "".join(f"<li>{e(n)}</li>" for n in r.notes) + "</ul>" if r.notes else ""
    description = f'<p class="desc">{e(r.description)}</p>' if r.description else ""

    head_extra = actions = ""
    if page:
        ld = json.dumps(to_json_ld(result, page), separators=(",", ":"), ensure_ascii=False)
        ld = ld.replace("<", "\\u003c")  # keep "</script>" in the data from ending the tag
        head_extra = (
            '<meta name="robots" content="noindex, nofollow">\n'
            f'<meta property="og:title" content="{e(r.name)} - RCPY">\n'
            f'<script type="application/ld+json">{ld}</script>\n'
        )
        actions = (
            '<p class="actions">'
            f'<a href="{e(page.markdown_url)}" download>Markdown (.md)</a> &middot; '
            f'<a href="{e(page.crumb_url)}" download>Crouton (.crumb)</a> &middot; '
            '<a href="#" onclick="window.print();return false">Print / PDF</a></p>'
        )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(r.name)} - RCPY</title>
{head_extra}<style>
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
{actions}
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


def _iso_minutes(minutes: int | None) -> str | None:
    return f"PT{minutes}M" if minutes is not None else None


def to_json_ld(result: ParseResult, page: PageInfo) -> dict:
    """schema.org/Recipe, so recipe importers and search engines can read the page."""
    r = result.recipe
    total = (r.prep_minutes or 0) + (r.cook_minutes or 0)
    data = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": r.name,
        "description": r.description or None,
        "author": {"@type": "Organization", "name": "RCPY"},
        "datePublished": page.created_at.date().isoformat(),
        "dateModified": page.updated_at.date().isoformat(),
        "url": page.url,
        "mainEntityOfPage": page.url,
        "recipeYield": f"{r.servings} servings" if r.servings else None,
        "prepTime": _iso_minutes(r.prep_minutes),
        "cookTime": _iso_minutes(r.cook_minutes),
        "totalTime": _iso_minutes(total) if total else None,
        "recipeIngredient": [" ".join(p for p in (i.quantity, i.name) if p) for i in r.ingredients],
        "recipeInstructions": [{"@type": "HowToStep", "position": n, "text": s.text} for n, s in enumerate(r.steps, 1)],
        "keywords": ["dictated recipe", "family recipe", "voice recipe"],
    }
    return {k: v for k, v in data.items() if v is not None}


def _crumb_number(value: float | None) -> float | int:
    if value is None:
        return 1
    return int(value) if float(value).is_integer() else value


def to_crumb(recipe: StoredRecipe, base_url: str) -> dict:
    """Crouton's .crumb import format (a JSON file)."""
    return {
        "tags": [],
        "cookingDuration": recipe.cook_minutes or 0,
        "webLink": f"{base_url}/r/{recipe.slug}",
        "duration": recipe.prep_minutes or 0,
        "images": [],
        "uuid": str(recipe.uuid).upper(),
        "serves": recipe.servings or 1,
        "ingredients": [
            {
                "order": order,
                "ingredient": {
                    "name": " · ".join(p for p in (item.name, item.quantity if item.amount is None else "") if p),
                    "uuid": str(item.id).upper(),
                },
                "uuid": str(secrets.token_hex(16)).upper(),
                "quantity": {"quantityType": item.unit.value, "amount": _crumb_number(item.amount)},
            }
            for order, item in enumerate(recipe.ingredients)
        ],
        "sourceImage": "",
        "name": recipe.name,
        "steps": [
            {"uuid": str(step.id).upper(), "isSection": False, "order": order, "step": step.text}
            for order, step in enumerate(recipe.steps)
        ],
        "folderIDs": [],
        "nutritionalInfo": "",
        "isPublicRecipe": False,
        "defaultScale": 1,
        "sourceName": urlparse(base_url).hostname or "",
    }


RENDERERS = {"json": to_json, "md": to_markdown, "html": to_html}


def render(result: ParseResult, fmt: str) -> str:
    return RENDERERS[fmt](result)
