import { z } from "zod";

export const quantityUnits = [
  "ITEM",
  "CUP",
  "TABLESPOON",
  "TEASPOON",
  "OUNCE",
  "POUND",
  "GRAM",
  "KILOGRAM",
  "MILLILITER",
  "LITER"
];

export const extractedIngredientSchema = z.object({
  quantity: z.string().describe("Human-readable quantity exactly as it should display."),
  amount: z.number().nullable().describe("Numeric quantity, or null if not spoken."),
  unit: z.enum(quantityUnits).describe("Closest supported normalized unit."),
  name: z.string().min(1).describe("Ingredient name including preparation notes."),
  uncertain: z.boolean().describe("True when wording or quantity may be unreliable.")
});

export const extractedStepSchema = z.object({
  text: z.string().min(1),
  uncertain: z.boolean()
});

export const extractedRecipeSchema = z.object({
  sourceLanguage: z.string().min(1),
  englishTranscript: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  servings: z.number().int().positive().nullable(),
  prepMinutes: z.number().int().nonnegative().nullable(),
  cookMinutes: z.number().int().nonnegative().nullable(),
  ingredients: z.array(extractedIngredientSchema).min(1),
  steps: z.array(extractedStepSchema).min(1),
  notes: z.array(z.string())
});

export const clientIngredientSchema = extractedIngredientSchema.extend({
  id: z.string().uuid()
});

export const clientStepSchema = extractedStepSchema.extend({
  id: z.string().uuid()
});

export const recipeDraftSchema = z.object({
  sourceLanguage: z.string().min(1).max(80),
  originalTranscript: z.string().min(1).max(200000),
  englishTranscript: z.string().min(1).max(200000),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  servings: z.number().int().positive().nullable(),
  prepMinutes: z.number().int().nonnegative().nullable(),
  cookMinutes: z.number().int().nonnegative().nullable(),
  ingredients: z.array(clientIngredientSchema).min(1).max(200),
  steps: z.array(clientStepSchema).min(1).max(200),
  notes: z.array(z.string().max(1000)).max(50)
});

export const storedRecipeSchema = recipeDraftSchema.extend({
  slug: z.string().min(8),
  uuid: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime()
});
