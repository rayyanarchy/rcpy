import crypto from "node:crypto";
import { APP_NAME } from "./constants.js";

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
      name: APP_NAME
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
    keywords: ["dictated recipe", "family recipe", "voice recipe"]
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

export function recipeToMarkdown(recipe, baseUrl) {
  const pageUrl = baseUrl && recipe.slug ? `${baseUrl}/r/${recipe.slug}` : "";
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  const metaLines = [];
  if (recipe.servings) metaLines.push(`- **Servings:** ${recipe.servings}`);
  if (recipe.prepMinutes != null) metaLines.push(`- **Prep Time:** ${recipe.prepMinutes} minutes`);
  if (recipe.cookMinutes != null) metaLines.push(`- **Cook Time:** ${recipe.cookMinutes} minutes`);
  if (totalMinutes > 0) metaLines.push(`- **Total Time:** ${totalMinutes} minutes`);
  if (pageUrl) metaLines.push(`- **Link:** [${recipe.name}](${pageUrl})`);

  const ingredientsList = (recipe.ingredients || [])
    .map((item) => {
      const parts = [item.quantity, item.name].filter(Boolean).join(" ");
      return `- [ ] ${parts}`;
    })
    .join("\n");

  const stepsList = (recipe.steps || [])
    .map((step, index) => `${index + 1}. ${step.text}`)
    .join("\n\n");

  const sections = [
    `# ${recipe.name}`,
    recipe.description ? `\n\n> ${recipe.description}` : "",
    metaLines.length ? `\n\n${metaLines.join("\n")}` : "",
    `\n\n## Ingredients\n\n${ingredientsList || "_No ingredients listed_"}`,
    `\n\n## Method\n\n${stepsList || "_No instructions listed_"}`,
    `\n\n---\n*Transcribed and formatted with ${APP_NAME}.*`
  ];

  return sections.join("").trim() + "\n";
}

export function renderRecipePage(recipe, baseUrl) {
  const jsonLd = recipeToJsonLd(recipe, baseUrl);
  const ingredientItems = recipe.ingredients
    .map(
      (item) =>
        `<li><span class="ingredient-qty">${escapeHtml(item.quantity)}</span> <span class="ingredient-name">${escapeHtml(item.name)}</span></li>`
    )
    .join("");
  const stepItems = recipe.steps
    .map(
      (step, index) =>
        `<li><span class="step-num">${index + 1}</span><p>${escapeHtml(step.text)}</p></li>`
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

  const pageUrl = `${baseUrl}/r/${recipe.slug}`;
  const crumbUrl = `${baseUrl}/api/recipes/${recipe.slug}/crumb`;
  const mdUrl = `${baseUrl}/api/recipes/${recipe.slug}/md`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="${escapeHtml(recipe.description || recipe.name)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(recipe.name)} — ${APP_NAME}">
  <meta property="og:description" content="${escapeHtml(recipe.description || `A recipe transcribed with ${APP_NAME}.`)}">
  <link rel="icon" type="image/svg+xml" href="/rcpy_icon.svg">
  <title>${escapeHtml(recipe.name)} — ${APP_NAME}</title>
  <script type="application/ld+json">${safeJson(jsonLd)}</script>
  <style>
    :root {
      --paper: #fffefd;
      --ink: #26142e;
      --muted: #6f6572;
      --coral: #f45b48;
      --coral-dark: #d94434;
      --coral-soft: #fff1ee;
      --line: #e5dfe3;
      --line-strong: #cfc5cc;
      --serif: "Fraunces", Georgia, "Times New Roman", serif;
      --sans: "DM Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      -webkit-font-smoothing: antialiased;
    }
    header {
      height: 72px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(16px, 5vw, 64px);
    }
    .brand-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--ink);
      font-family: var(--serif);
      font-weight: 600;
      font-size: 1.45rem;
      letter-spacing: -0.03em;
    }
    .brand-link img {
      width: 28px;
      height: 28px;
      display: block;
    }
    .header-exports {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .export-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 9999px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      font-size: 0.85rem;
      font-weight: 550;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .export-btn:hover {
      border-color: var(--line-strong);
      background: var(--coral-soft);
      color: var(--coral-dark);
    }
    .export-btn--primary {
      background: var(--coral);
      border-color: var(--coral);
      color: #fff;
    }
    .export-btn--primary:hover {
      background: var(--coral-dark);
      border-color: var(--coral-dark);
      color: #fff;
    }
    main {
      width: min(960px, 90vw);
      margin: 48px auto 96px;
    }
    h1, h2 {
      font-family: var(--serif);
      letter-spacing: -0.035em;
    }
    h1 {
      font-size: clamp(2.6rem, 6vw, 4.8rem);
      line-height: 1.05;
      margin: 0 0 20px;
      color: var(--ink);
    }
    .description {
      font-size: 1.15rem;
      line-height: 1.6;
      color: var(--muted);
      max-width: 680px;
      margin: 0 0 28px;
    }
    .actions-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 36px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--line);
    }
    .facts {
      display: flex;
      gap: 32px;
      margin: 28px 0 48px;
      padding: 20px 0;
      border-block: 1px solid var(--line);
    }
    dl { display: contents; }
    .facts div { min-width: 90px; }
    .facts dt {
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 0.72rem;
      color: var(--muted);
      font-weight: 700;
    }
    .facts dd {
      margin: 6px 0 0;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .columns {
      display: grid;
      grid-template-columns: minmax(260px, 0.85fr) 1.25fr;
      gap: 6vw;
    }
    h2 {
      font-size: 1.75rem;
      margin: 0 0 20px;
      border-bottom: 2px solid var(--coral-soft);
      padding-bottom: 8px;
    }
    ul, ol {
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .ingredients li {
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      line-height: 1.45;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ingredients .ingredient-qty {
      color: var(--coral);
      font-size: 0.88rem;
      font-weight: 700;
    }
    .ingredients .ingredient-name {
      font-size: 0.98rem;
    }
    .steps li {
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .steps .step-num {
      width: 32px;
      height: 32px;
      border: 1px solid var(--coral);
      color: var(--coral);
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: 0.88rem;
      flex-shrink: 0;
    }
    .steps p {
      margin: 2px 0 0;
      line-height: 1.65;
      font-size: 1rem;
    }
    footer {
      color: var(--muted);
      border-top: 1px solid var(--line);
      padding: 24px 5vw;
      font-size: 0.88rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    footer a {
      color: var(--coral);
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 760px) {
      main { margin-top: 32px; }
      .facts { gap: 20px; flex-wrap: wrap; }
      .columns { grid-template-columns: 1fr; gap: 40px; }
      .header-exports { display: none; }
      .actions-strip { justify-content: flex-start; }
    }

    @media print {
      header, .actions-strip, footer { display: none !important; }
      body { background: #fff !important; color: #000 !important; font-size: 11pt; }
      main { width: 100% !important; margin: 0 !important; }
      h1 { font-size: 24pt !important; margin-bottom: 8pt !important; }
      .description { font-size: 11pt !important; margin-bottom: 12pt !important; color: #333 !important; }
      .facts { border-block: 1px solid #ccc !important; padding: 8pt 0 !important; margin: 12pt 0 !important; }
      .facts dt { color: #666 !important; }
      .columns { display: block !important; }
      .columns > section { margin-bottom: 16pt !important; page-break-inside: avoid; }
      .steps li { page-break-inside: avoid; }
      .steps .step-num { border-color: #000 !important; color: #000 !important; }
      .ingredients .ingredient-qty { color: #000 !important; }
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="brand-link">
      <img src="/rcpy_icon.svg" alt="" />
      <span>${APP_NAME}</span>
    </a>
    <div class="header-exports">
      <button class="export-btn" type="button" onclick="window.print()">
        Print / PDF
      </button>
      <a class="export-btn" href="${mdUrl}" download>
        Download .md
      </a>
      <a class="export-btn export-btn--primary" href="${crumbUrl}" download>
        Download .crumb
      </a>
    </div>
  </header>
  <main>
    <h1>${escapeHtml(recipe.name)}</h1>
    ${recipe.description ? `<p class="description">${escapeHtml(recipe.description)}</p>` : ""}
    <div class="actions-strip">
      <button class="export-btn" type="button" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / PDF
      </button>
      <a class="export-btn" href="${mdUrl}" download>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Markdown (.md)
      </a>
      <a class="export-btn" href="${crumbUrl}" download>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Crouton (.crumb)
      </a>
      <button class="export-btn" type="button" id="copyBtn" onclick="navigator.clipboard.writeText(window.location.href); this.textContent='Link Copied!'; setTimeout(() => this.textContent='Copy Link', 2000)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
        Copy Link
      </button>
    </div>
    <section class="facts"><dl>${timing}</dl></section>
    <div class="columns">
      <section><h2>Ingredients</h2><ul class="ingredients">${ingredientItems}</ul></section>
      <section><h2>Method</h2><ol class="steps">${stepItems}</ol></section>
    </div>
  </main>
  <footer>
    <span>Transcribed and prepared with <a href="/">${APP_NAME}</a>.</span>
    <span>Ready for Crouton, Markdown, & PDF.</span>
  </footer>
</body>
</html>`;
}
