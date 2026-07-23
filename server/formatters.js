import crypto from "node:crypto";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeJson = (value) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");

const isoDuration = (minutes) =>
  Number.isFinite(minutes) && minutes >= 0 ? `PT${minutes}M` : undefined;

export function getBaseUrl(req, configuredBaseUrl = "") {
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, "");
  const forwardedProtocol = req.get("x-forwarded-proto");
  const protocol = forwardedProtocol?.split(",")[0] || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

export function recipeToJsonLd(recipe, baseUrl) {
  const pageUrl = `${baseUrl}/r/${recipe.slug}`;
  const totalMinutes =
    (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name,
    description: recipe.description || undefined,
    author: {
      "@type": "Organization",
      name: "Crumbly"
    },
    datePublished: recipe.createdAt.slice(0, 10),
    dateModified: recipe.updatedAt.slice(0, 10),
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    recipeYield: recipe.servings
      ? `${recipe.servings} servings`
      : undefined,
    prepTime: isoDuration(recipe.prepMinutes),
    cookTime: isoDuration(recipe.cookMinutes),
    totalTime: totalMinutes ? isoDuration(totalMinutes) : undefined,
    recipeIngredient: recipe.ingredients.map((item) =>
      [item.quantity, item.name].filter(Boolean).join(" ")
    ),
    recipeInstructions: recipe.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      text: step.text
    })),
    keywords: ["dictated recipe", "family recipe"]
  };
}

function crumbAmount(ingredient) {
  return Number.isFinite(ingredient.amount) ? ingredient.amount : 1;
}

export function recipeToCrumb(recipe, baseUrl) {
  const webLink = `${baseUrl}/r/${recipe.slug}`;
  const sourceName = new URL(baseUrl).hostname;

  return {
    tags: [],
    cookingDuration: recipe.cookMinutes ?? 0,
    webLink,
    duration: recipe.prepMinutes ?? 0,
    images: [],
    uuid: recipe.uuid.toUpperCase(),
    serves: recipe.servings ?? 1,
    ingredients: recipe.ingredients.map((item, order) => ({
      order,
      ingredient: {
        name: [item.name, item.amount == null ? item.quantity : ""]
          .filter(Boolean)
          .join(" · "),
        uuid: item.id.toUpperCase()
      },
      uuid: crypto.randomUUID().toUpperCase(),
      quantity: {
        quantityType: item.unit,
        amount: crumbAmount(item)
      }
    })),
    sourceImage: "",
    name: recipe.name,
    steps: recipe.steps.map((step, order) => ({
      uuid: step.id.toUpperCase(),
      isSection: false,
      order,
      step: step.text
    })),
    folderIDs: [],
    nutritionalInfo: "",
    isPublicRecipe: false,
    defaultScale: 1,
    sourceName
  };
}

export function renderRecipePage(recipe, baseUrl) {
  const jsonLd = recipeToJsonLd(recipe, baseUrl);
  const ingredientItems = recipe.ingredients
    .map(
      (item) =>
        `<li><span>${escapeHtml(item.quantity)}</span>${escapeHtml(item.name)}</li>`
    )
    .join("");
  const stepItems = recipe.steps
    .map(
      (step, index) =>
        `<li><span>${index + 1}</span><p>${escapeHtml(step.text)}</p></li>`
    )
    .join("");
  const timing = [
    recipe.prepMinutes != null
      ? `<div><dt>Prep</dt><dd>${recipe.prepMinutes} min</dd></div>`
      : "",
    recipe.cookMinutes != null
      ? `<div><dt>Cook</dt><dd>${recipe.cookMinutes} min</dd></div>`
      : "",
    recipe.servings != null
      ? `<div><dt>Serves</dt><dd>${recipe.servings}</dd></div>`
      : ""
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="${escapeHtml(recipe.description || recipe.name)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(recipe.name)}">
  <meta property="og:description" content="${escapeHtml(recipe.description || "A recipe transcribed with Crumbly.")}">
  <title>${escapeHtml(recipe.name)} — Crumbly</title>
  <script type="application/ld+json">${safeJson(jsonLd)}</script>
  <style>
    :root{--paper:#fffefd;--ink:#26142e;--muted:#6d6370;--coral:#f45b48;--line:#e5dfe3}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{height:70px;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 5vw;font-weight:750;letter-spacing:-.02em}
    header b{color:var(--coral);margin-right:10px}main{width:min(980px,90vw);margin:70px auto 100px}
    h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.035em}h1{font-size:clamp(3rem,8vw,6rem);line-height:.98;margin:0 0 24px}
    .description{font-size:1.2rem;line-height:1.6;color:var(--muted);max-width:720px}.facts{display:flex;gap:36px;margin:36px 0 64px;padding:24px 0;border-block:1px solid var(--line)}
    dl{display:contents}.facts div{min-width:100px}.facts dt{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;color:var(--muted);font-weight:700}.facts dd{margin:6px 0 0;font-weight:650}
    .columns{display:grid;grid-template-columns:minmax(260px,.75fr) 1.25fr;gap:8vw}h2{font-size:2rem;margin:0 0 24px}
    ul,ol{padding:0;margin:0;list-style:none}.ingredients li{padding:14px 0;border-bottom:1px solid var(--line);line-height:1.45}.ingredients li span{display:block;color:var(--coral);font-size:.86rem;font-weight:700;margin-bottom:4px}
    .steps li{display:grid;grid-template-columns:40px 1fr;gap:16px;margin-bottom:28px}.steps li>span{width:34px;height:34px;border:1px solid var(--coral);color:var(--coral);border-radius:50%;display:grid;place-items:center;font-weight:700}.steps p{margin:4px 0 0;line-height:1.65}
    footer{color:var(--muted);border-top:1px solid var(--line);padding:24px 5vw;font-size:.88rem}
    @media(max-width:720px){main{margin-top:44px}.facts{gap:20px;flex-wrap:wrap}.columns{grid-template-columns:1fr;gap:56px}}
  </style>
</head>
<body>
  <header><b>●</b> Crumbly</header>
  <main>
    <h1>${escapeHtml(recipe.name)}</h1>
    ${recipe.description ? `<p class="description">${escapeHtml(recipe.description)}</p>` : ""}
    <section class="facts"><dl>${timing}</dl></section>
    <div class="columns">
      <section><h2>Ingredients</h2><ul class="ingredients">${ingredientItems}</ul></section>
      <section><h2>Method</h2><ol class="steps">${stepItems}</ol></section>
    </div>
  </main>
  <footer>Transcribed and prepared for recipe import with Crumbly.</footer>
</body>
</html>`;
}
