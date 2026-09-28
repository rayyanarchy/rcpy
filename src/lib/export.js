export function formatRecipeMarkdown(recipe, pageUrl = "") {
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
    `\n\n---\n*Transcribed and formatted with RCPY.*`
  ];

  return sections.join("").trim() + "\n";
}

export function downloadBlob(content, fileName, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printRecipeCard(recipe) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  const ingredientItems = (recipe.ingredients || [])
    .map(
      (item) =>
        `<li><span class="qty">${item.quantity || ""}</span> <span>${item.name || ""}</span></li>`
    )
    .join("");

  const stepItems = (recipe.steps || [])
    .map(
      (step, index) =>
        `<li><span class="num">${index + 1}</span><p>${step.text || ""}</p></li>`
    )
    .join("");

  const timing = [
    recipe.prepMinutes != null ? `<div><strong>Prep:</strong> ${recipe.prepMinutes} min</div>` : "",
    recipe.cookMinutes != null ? `<div><strong>Cook:</strong> ${recipe.cookMinutes} min</div>` : "",
    recipe.servings != null ? `<div><strong>Servings:</strong> ${recipe.servings}</div>` : ""
  ].join("");

  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${recipe.name} — RCPY</title>
  <style>
    @page { margin: 1.5cm; }
    body { font-family: ui-sans-serif, -apple-system, system-ui, sans-serif; color: #111; line-height: 1.5; margin: 0; padding: 20px; }
    h1 { font-family: Georgia, serif; font-size: 26pt; margin: 0 0 10px; color: #000; }
    .desc { font-style: italic; color: #444; margin-bottom: 16px; font-size: 11pt; }
    .facts { display: flex; gap: 20px; border-block: 1px solid #ddd; padding: 8px 0; margin-bottom: 24px; font-size: 10pt; }
    .grid { display: grid; grid-template-columns: 240px 1fr; gap: 30px; }
    h2 { font-size: 14pt; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 0; }
    ul, ol { padding: 0; margin: 0; list-style: none; }
    .ingredients li { padding: 4px 0; border-bottom: 1px dotted #eee; font-size: 10pt; }
    .ingredients .qty { font-weight: bold; margin-right: 4px; }
    .steps li { display: flex; gap: 10px; margin-bottom: 12px; font-size: 10pt; }
    .steps .num { font-weight: bold; width: 20px; height: 20px; border-radius: 50%; border: 1px solid #333; display: flex; align-items: center; justify-content: center; font-size: 8pt; flex-shrink: 0; }
    .steps p { margin: 0; }
    .footer { margin-top: 30px; font-size: 8pt; color: #777; border-top: 1px solid #eee; padding-top: 8px; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>${recipe.name}</h1>
  ${recipe.description ? `<p class="desc">${recipe.description}</p>` : ""}
  ${timing ? `<div class="facts">${timing}</div>` : ""}
  <div class="grid">
    <section>
      <h2>Ingredients</h2>
      <ul class="ingredients">${ingredientItems}</ul>
    </section>
    <section>
      <h2>Method</h2>
      <ol class="steps">${stepItems}</ol>
    </section>
  </div>
  <div class="footer">Transcribed & prepared with RCPY.</div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`);
  printWindow.document.close();
}
