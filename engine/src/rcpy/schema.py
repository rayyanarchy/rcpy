"""Data models. These are the single source of truth for what a recipe looks like.

The same models are used to (1) tell Gemini what JSON shape to return and
(2) validate what comes back, so bad model output fails loudly instead of
leaking into the formatters.
"""

from enum import StrEnum

from pydantic import BaseModel, Field


class Unit(StrEnum):
    ITEM = "ITEM"
    CUP = "CUP"
    TABLESPOON = "TABLESPOON"
    TEASPOON = "TEASPOON"
    OUNCE = "OUNCE"
    POUND = "POUND"
    GRAM = "GRAM"
    KILOGRAM = "KILOGRAM"
    MILLILITER = "MILLILITER"
    LITER = "LITER"


class Ingredient(BaseModel):
    quantity: str = Field(description="Human-readable quantity exactly as it should display.")
    amount: float | None = Field(description="Numeric quantity, or null if not spoken.")
    unit: Unit = Field(description="Closest supported normalized unit.")
    name: str = Field(min_length=1, description="Ingredient name including preparation notes.")
    uncertain: bool = Field(description="True when wording or quantity may be unreliable.")


class Step(BaseModel):
    text: str = Field(min_length=1)
    uncertain: bool


class Recipe(BaseModel):
    source_language: str = Field(min_length=1)
    english_transcript: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str
    servings: int | None = Field(ge=1)
    prep_minutes: int | None = Field(ge=0)
    cook_minutes: int | None = Field(ge=0)
    ingredients: list[Ingredient] = Field(min_length=1)
    steps: list[Step] = Field(min_length=1)
    notes: list[str]


class ParseResult(BaseModel):
    """What a strategy returns for one audio file."""

    original_transcript: str = Field(min_length=1)
    recipe: Recipe
