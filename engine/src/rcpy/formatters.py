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
    expires_at: datetime | None = None

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


_PAGE_CSS = """
:root{--bg:#fafaf9;--surface:#fff;--ink:#121212;--ink-2:#55554f;--ink-3:#6b6b66;--line:#e4e4e0;--line-soft:#ededea;
--amber:#d97a00;--sans:"Geist",ui-sans-serif,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.page{max-width:960px;margin:0 auto;padding:0 24px}
header{display:flex;align-items:center;justify-content:space-between;padding:28px 0}
header img{width:34px;height:auto;display:block}
.pill{font:13px var(--mono);color:var(--ink-2);border:1px solid var(--line);border-radius:999px;padding:5px 12px}
.intro{padding:72px 0 40px;border-bottom:1px solid var(--line)}
h1{margin:0;font-size:clamp(44px,9vw,88px);font-weight:500;letter-spacing:-.045em;line-height:1}
.desc{margin:16px 0 0;max-width:620px;font-size:18px;color:var(--ink-2)}
.facts{margin:16px 0 0;font:13px var(--mono);color:var(--ink-2)}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
.button{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 18px;border:1px solid var(--line);
border-radius:12px;background:var(--surface);font-size:15px;cursor:pointer;font-family:inherit;color:inherit}
.button.primary{background:var(--ink);border-color:var(--ink);color:#fff;font-weight:500}
.button img{width:22px;height:22px}
.grid{display:grid;grid-template-columns:340px minmax(0,1fr);gap:64px;padding:40px 0 96px}
h2{margin:0 0 12px;font:400 12px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3)}
ul,ol{margin:0;padding:0;list-style:none}
.ingredients li{display:grid;grid-template-columns:112px minmax(0,1fr);gap:10px;padding:9px 0;
border-bottom:1px solid var(--line-soft);font-size:15px;line-height:1.45}
.qty{font:13px var(--mono);color:var(--ink-2);padding-top:1px}
.steps li{display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;padding:14px 0;border-bottom:1px solid var(--line-soft)}
.n{font:13px var(--mono);color:var(--ink-3);padding-top:3px}
.steps p{margin:0;font-size:17px}
.uncertain>:last-child::after{content:"";display:inline-block;width:6px;height:6px;margin-left:8px;border-radius:999px;
background:var(--amber);vertical-align:middle}
.notes{margin-top:32px;color:var(--ink-2)}
.notes li{padding:4px 0}
footer{padding:32px 0 48px;border-top:1px solid var(--line);font-size:14px;color:var(--ink-3)}
footer a{color:var(--ink)}
@media (max-width:760px){.intro{padding:40px 0 28px}.grid{grid-template-columns:minmax(0,1fr);gap:40px}}
@media print{header,.actions,footer{display:none}.intro{padding-top:0}body{background:#fff}}
"""

# Fills in "expires in N min" from the timestamp, and keeps it current.
_COUNTDOWN = """<script>
(()=>{const el=document.querySelector("[data-expires]");if(!el)return;const end=Date.parse(el.dataset.expires);
const tick=()=>{const m=Math.ceil((end-Date.now())/60000);el.textContent=m>0?`Link expires in ${m} min`:"This link has expired";};
tick();setInterval(tick,30000);})();
</script>"""


def _page(title: str, head: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="icon" type="image/svg+xml" href="/rcpy_icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono&display=swap">
{head}<style>{_PAGE_CSS}</style>
</head>
<body>
<div class="page">
{body}
</div>
</body>
</html>
"""


def to_html(result: ParseResult, page: PageInfo | None = None) -> str:
    """A standalone recipe page: the public /r/<slug> page, and `rcpy parse -f html`."""
    r = result.recipe
    e = escape
    facts = " · ".join(
        text
        for text in (
            f"Serves {r.servings}" if r.servings else "",
            f"Prep {r.prep_minutes} min" if r.prep_minutes is not None else "",
            f"Cook {r.cook_minutes} min" if r.cook_minutes is not None else "",
        )
        if text
    )
    ingredients = "".join(
        f'<li{" class=uncertain" if i.uncertain else ""}><span class="qty">{e(i.quantity)}</span><span>{e(i.name)}</span></li>'
        for i in r.ingredients
    )
    steps = "".join(
        f'<li{" class=uncertain" if s.uncertain else ""}><span class="n">{n:02d}</span><p>{e(s.text)}</p></li>'
        for n, s in enumerate(r.steps, 1)
    )
    notes = '<ul class="notes">' + "".join(f"<li>{e(n)}</li>" for n in r.notes) + "</ul>" if r.notes else ""

    head = header_right = actions = ""
    if page:
        ld = json.dumps(to_json_ld(result, page), separators=(",", ":"), ensure_ascii=False)
        ld = ld.replace("<", "\\u003c")  # keep "</script>" in the data from ending the tag
        head = (
            '<meta name="robots" content="noindex, nofollow">\n'
            f'<meta property="og:title" content="{e(r.name)} - RCPY">\n'
            f'<script type="application/ld+json">{ld}</script>\n'
        )
        if page.expires_at:
            header_right = (
                f'<span class="pill" data-expires="{page.expires_at.isoformat()}">Link expires within the hour</span>'
            )
        actions = (
            '<div class="actions">'
            f'<a class="button primary" href="{e(page.crumb_url)}" download><img src="/crouton_icon.png" alt="">Open in Crouton</a>'
            f'<a class="button" href="{e(page.markdown_url)}" download>Markdown</a>'
            '<button class="button" type="button" onclick="window.print()">Print or PDF</button>'
            "</div>"
        )

    # The logo is served by the RCPY server; a page saved by the CLI has no server to load it from.
    logo = '<a href="/" aria-label="RCPY home"><img src="/rcpy_icon.svg" alt="RCPY"></a>' if page else "<span></span>"
    body = f"""<header>{logo}{header_right}</header>
<article>
<section class="intro">
<h1>{e(r.name)}</h1>
{f'<p class="desc">{e(r.description)}</p>' if r.description else ""}
{f'<p class="facts">{facts}</p>' if facts else ""}
{actions}
</section>
<div class="grid">
<section><h2>Ingredients</h2><ul class="ingredients">{ingredients}</ul></section>
<section><h2>Method</h2><ol class="steps">{steps}</ol>{notes}</section>
</div>
</article>
<footer>Written down from a voice note with <a href="https://github.com/rayyanarchy/rcpy">RCPY</a>.</footer>
{_COUNTDOWN if header_right else ""}"""
    return _page(f"{e(r.name)} - RCPY", head, body)


def not_found_html() -> str:
    body = """<header><a href="/" aria-label="RCPY home"><img src="/rcpy_icon.svg" alt="RCPY"></a></header>
<section class="intro" style="border:none">
<h1>This recipe is gone</h1>
<p class="desc">Shared recipes are deleted an hour after they are saved. Ask whoever sent the link to share it again,
or <a href="/" style="text-decoration:underline">make your own from a voice note</a>.</p>
</section>"""
    return _page("Recipe not found - RCPY", '<meta name="robots" content="noindex">\n', body)


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
