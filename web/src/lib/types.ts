// Wire types for the engine API (engine/src/rcpy/draft.py, camelCase on the wire).

export type Unit =
  | "ITEM"
  | "CUP"
  | "TABLESPOON"
  | "TEASPOON"
  | "OUNCE"
  | "POUND"
  | "GRAM"
  | "KILOGRAM"
  | "MILLILITER"
  | "LITER";

export interface Ingredient {
  id: string;
  quantity: string;
  amount: number | null;
  unit: Unit;
  name: string;
  uncertain: boolean;
}

export interface Step {
  id: string;
  text: string;
  uncertain: boolean;
}

export interface RecipeDraft {
  sourceLanguage: string;
  originalTranscript: string;
  englishTranscript: string;
  name: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  notes: string[];
}

export interface StoredRecipe extends RecipeDraft {
  slug: string;
  uuid: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface PublishResponse {
  recipe: StoredRecipe;
  url: string;
  crumbUrl: string;
  markdownUrl: string;
}

/** One line of `POST /api/process?stream=true`. */
export type ProcessEvent =
  | { event: "plan"; stages: string[] }
  | { event: "stage"; name: string; status: "start" | "done"; seconds?: number }
  | { event: "transcript"; sourceLanguage: string; originalTranscript: string; englishTranscript: string }
  | { event: "draft"; draft: RecipeDraft }
  | { event: "error"; error: string; status: number };
