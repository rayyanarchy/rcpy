import type { RecipeDraft } from "./types";

export function fileSlug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "recipe";
}

export function toMarkdown(recipe: RecipeDraft, link?: string): string {
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const meta = [
    recipe.servings ? `- **Servings:** ${recipe.servings}` : "",
    recipe.prepMinutes != null ? `- **Prep:** ${recipe.prepMinutes} minutes` : "",
    recipe.cookMinutes != null ? `- **Cook:** ${recipe.cookMinutes} minutes` : "",
    total > 0 ? `- **Total:** ${total} minutes` : "",
    link ? `- **Link:** [${recipe.name}](${link})` : "",
  ].filter(Boolean);
  const ingredients = recipe.ingredients
    .map((i) => `- [ ] ${[i.quantity, i.name].filter(Boolean).join(" ")}`)
    .join("\n");
  const steps = recipe.steps.map((s, n) => `${n + 1}. ${s.text}`).join("\n\n");
  const notes = recipe.notes.map((n) => `- ${n}`).join("\n");
  return [
    `# ${recipe.name}`,
    recipe.description && `> ${recipe.description}`,
    meta.length > 0 && meta.join("\n"),
    `## Ingredients\n\n${ingredients}`,
    `## Method\n\n${steps}`,
    notes && `## Notes\n\n${notes}`,
    "---\n*Written down from a voice note with RCPY.*",
  ]
    .filter(Boolean)
    .join("\n\n")
    .concat("\n");
}

export function download(content: string, fileName: string, type = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Open a print-ready page (Save as PDF from the print dialog). */
export function printRecipe(recipe: RecipeDraft): void {
  const win = window.open("", "_blank");
  if (!win) return window.print();
  const facts = [
    recipe.servings != null && `Serves ${recipe.servings}`,
    recipe.prepMinutes != null && `Prep ${recipe.prepMinutes} min`,
    recipe.cookMinutes != null && `Cook ${recipe.cookMinutes} min`,
  ].filter(Boolean);
  win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${escape(recipe.name)}</title>
<style>
@page{margin:18mm}
body{font-family:"Geist",ui-sans-serif,system-ui,sans-serif;color:#121212;margin:0;line-height:1.55;font-size:11pt}
h1{font-size:30pt;letter-spacing:-0.03em;font-weight:500;margin:0 0 6pt}
.desc{color:#55554F;margin:0 0 10pt}
.facts{font-family:ui-monospace,monospace;font-size:9pt;color:#55554F;margin-bottom:18pt}
.grid{display:grid;grid-template-columns:200pt 1fr;gap:28pt}
h2{font-family:ui-monospace,monospace;font-weight:400;font-size:8pt;letter-spacing:.06em;text-transform:uppercase;color:#6B6B66;margin:0 0 6pt}
ul,ol{list-style:none;margin:0;padding:0}
li{padding:5pt 0;border-bottom:.5pt solid #E4E4E0;break-inside:avoid}
.q{font-family:ui-monospace,monospace;font-size:9pt;color:#55554F;display:inline-block;min-width:52pt}
.n{font-family:ui-monospace,monospace;font-size:8pt;color:#6B6B66;display:inline-block;width:20pt}
footer{margin-top:24pt;font-size:8pt;color:#6B6B66}
</style></head><body>
<h1>${escape(recipe.name)}</h1>
${recipe.description ? `<p class="desc">${escape(recipe.description)}</p>` : ""}
${facts.length ? `<div class="facts">${facts.join(" · ")}</div>` : ""}
<div class="grid">
<section><h2>Ingredients</h2><ul>${recipe.ingredients
    .map((i) => `<li><span class="q">${escape(i.quantity)}</span>${escape(i.name)}</li>`)
    .join("")}</ul></section>
<section><h2>Method</h2><ol>${recipe.steps
    .map((s, n) => `<li><span class="n">${String(n + 1).padStart(2, "0")}</span>${escape(s.text)}</li>`)
    .join("")}</ol></section>
</div>
<footer>Written down from a voice note with RCPY.</footer>
<script>window.onload=()=>window.print()</script>
</body></html>`);
  win.document.close();
}
