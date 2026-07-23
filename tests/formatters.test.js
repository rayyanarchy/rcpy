import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  recipeToCrumb,
  recipeToJsonLd,
  renderRecipePage
} from "../server/formatters.js";

function storedRecipe() {
  return {
    slug: "sample_12345",
    uuid: crypto.randomUUID(),
    createdAt: "2026-07-23T10:00:00.000Z",
    updatedAt: "2026-07-23T10:00:00.000Z",
    sourceLanguage: "Hindi",
    originalTranscript: "मसाला डालें।",
    englishTranscript: "Add the spices.",
    name: "Test Curry",
    description: "A test recipe.",
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 25,
    ingredients: [
      {
        id: crypto.randomUUID(),
        quantity: "2 tablespoons",
        amount: 2,
        unit: "TABLESPOON",
        name: "vegetable oil",
        uncertain: false
      },
      {
        id: crypto.randomUUID(),
        quantity: "to taste",
        amount: null,
        unit: "ITEM",
        name: "salt",
        uncertain: true
      }
    ],
    steps: [
      {
        id: crypto.randomUUID(),
        text: "Heat the oil.",
        uncertain: false
      }
    ],
    notes: []
  };
}

describe("recipe formatters", () => {
  it("creates standard Recipe JSON-LD", () => {
    const jsonLd = recipeToJsonLd(
      storedRecipe(),
      "https://crumbly.example"
    );

    expect(jsonLd["@type"]).toBe("Recipe");
    expect(jsonLd.recipeIngredient).toEqual([
      "2 tablespoons vegetable oil",
      "to taste salt"
    ]);
    expect(jsonLd.recipeInstructions[0]).toMatchObject({
      "@type": "HowToStep",
      position: 1,
      text: "Heat the oil."
    });
    expect(jsonLd.totalTime).toBe("PT35M");
  });

  it("matches the observed .crumb top-level shape", () => {
    const crumb = recipeToCrumb(
      storedRecipe(),
      "https://crumbly.example"
    );

    expect(Object.keys(crumb).sort()).toEqual(
      [
        "tags",
        "cookingDuration",
        "webLink",
        "duration",
        "images",
        "uuid",
        "serves",
        "ingredients",
        "sourceImage",
        "name",
        "steps",
        "folderIDs",
        "nutritionalInfo",
        "isPublicRecipe",
        "defaultScale",
        "sourceName"
      ].sort()
    );
    expect(crumb.ingredients[0].quantity).toEqual({
      quantityType: "TABLESPOON",
      amount: 2
    });
    expect(crumb.steps[0]).toMatchObject({
      isSection: false,
      order: 0,
      step: "Heat the oil."
    });
  });

  it("embeds importer-friendly JSON-LD in the public page", () => {
    const html = renderRecipePage(
      storedRecipe(),
      "https://crumbly.example"
    );

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Recipe"');
    expect(html).toContain("<h1>Test Curry</h1>");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });
});
