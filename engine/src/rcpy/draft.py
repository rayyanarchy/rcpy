"""API-facing models: an editable draft, and a stored (shared) recipe.

A draft is a ParseResult flattened, with a UUID on every ingredient and step so
the web editor can track rows. On the wire these use camelCase keys (the
React app's convention); in Python they stay snake_case.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from rcpy.schema import Ingredient, ParseResult, Recipe, Step

CAMEL = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CamelModel(BaseModel):
    model_config = CAMEL


class DraftIngredient(Ingredient):
    model_config = CAMEL
    id: UUID


class DraftStep(Step):
    model_config = CAMEL
    id: UUID


class RecipeDraft(CamelModel):
    source_language: str = Field(min_length=1, max_length=80)
    original_transcript: str = Field(min_length=1, max_length=200_000)
    english_transcript: str = Field(min_length=1, max_length=200_000)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(max_length=2000)
    servings: int | None = Field(gt=0)
    prep_minutes: int | None = Field(ge=0)
    cook_minutes: int | None = Field(ge=0)
    ingredients: list[DraftIngredient] = Field(min_length=1, max_length=200)
    steps: list[DraftStep] = Field(min_length=1, max_length=200)
    notes: list[Annotated[str, StringConstraints(max_length=1000)]] = Field(max_length=50)

    @classmethod
    def from_result(cls, result: ParseResult) -> "RecipeDraft":
        r = result.recipe
        return cls(
            source_language=r.source_language,
            original_transcript=result.original_transcript,
            english_transcript=r.english_transcript,
            name=r.name,
            description=r.description,
            servings=r.servings,
            prep_minutes=r.prep_minutes,
            cook_minutes=r.cook_minutes,
            ingredients=[DraftIngredient(**i.model_dump(), id=uuid4()) for i in r.ingredients],
            steps=[DraftStep(**s.model_dump(), id=uuid4()) for s in r.steps],
            notes=r.notes,
        )

    def to_result(self) -> ParseResult:
        """Drop the ids again, for the formatters."""
        return ParseResult(
            original_transcript=self.original_transcript,
            recipe=Recipe(
                source_language=self.source_language,
                english_transcript=self.english_transcript,
                name=self.name,
                description=self.description,
                servings=self.servings,
                prep_minutes=self.prep_minutes,
                cook_minutes=self.cook_minutes,
                ingredients=[Ingredient(**i.model_dump(exclude={"id"})) for i in self.ingredients],
                steps=[Step(**s.model_dump(exclude={"id"})) for s in self.steps],
                notes=self.notes,
            ),
        )


class StoredRecipe(RecipeDraft):
    slug: str = Field(min_length=8)
    uuid: UUID
    created_at: datetime
    updated_at: datetime
    expires_at: datetime


class DraftResponse(CamelModel):
    draft: RecipeDraft


class RecipeResponse(CamelModel):
    recipe: StoredRecipe


class PublishResponse(CamelModel):
    recipe: StoredRecipe
    url: str
    crumb_url: str
    markdown_url: str
