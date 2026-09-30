"""Ground-truth format for an eval case, and helpers to create and load cases."""

import shutil
from pathlib import Path

from pydantic import BaseModel, Field

from rcpy.schema import ParseResult, Unit


class GoldIngredient(BaseModel):
    name: str = Field(min_length=1, description="English name, without preparation notes.")
    aliases: list[str] = Field(default=[], description="Other names that count as a match, e.g. 'haldi'.")
    amount: float | None = Field(description="Spoken amount; null when none was spoken ('to taste').")
    amount_max: float | None = Field(default=None, description="Upper end of a spoken range ('15 to 20').")
    unit: Unit = Unit.ITEM


class GoldRecipe(BaseModel):
    name: str
    servings: int | None = None
    prep_minutes: int | None = None
    cook_minutes: int | None = None
    ingredients: list[GoldIngredient] = Field(min_length=1)
    steps: list[str] = Field(min_length=1, description="Every instruction that was spoken, in order.")


class GoldCase(BaseModel):
    id: str
    reviewed: bool = Field(default=False, description="Set to true only after checking every field against the audio.")
    language: str = Field(default="", description="What was spoken, e.g. 'en', 'hi-en', 'ur-en'.")
    speaker: str = ""
    tags: list[str] = Field(default=[], description="Free-form labels to slice results by, e.g. 'ranges'.")
    notes: str = ""
    recipe: GoldRecipe

    @classmethod
    def from_prediction(cls, case_id: str, result: ParseResult) -> "GoldCase":
        """A first draft to correct by hand. Faster than typing from scratch, but it
        anchors you to the model's answer, so listen to the audio while reviewing."""
        r = result.recipe
        return cls(
            id=case_id,
            language=r.source_language,
            recipe=GoldRecipe(
                name=r.name,
                servings=r.servings,
                prep_minutes=r.prep_minutes,
                cook_minutes=r.cook_minutes,
                ingredients=[GoldIngredient(name=i.name, amount=i.amount, unit=i.unit) for i in r.ingredients],
                steps=[s.text for s in r.steps],
            ),
        )


def cases_dir(data_dir: str | Path) -> Path:
    return Path(data_dir) / "evals" / "cases"


def audio_path(case_dir: Path) -> Path | None:
    return next((p for p in sorted(case_dir.glob("audio.*"))), None)


def load_case(case_dir: Path) -> GoldCase:
    return GoldCase.model_validate_json((case_dir / "gold.json").read_text(encoding="utf-8"))


def save_case(case_dir: Path, case: GoldCase) -> None:
    case_dir.mkdir(parents=True, exist_ok=True)
    (case_dir / "gold.json").write_text(case.model_dump_json(indent=2) + "\n", encoding="utf-8")


def list_cases(data_dir: str | Path) -> list[tuple[Path, GoldCase]]:
    root = cases_dir(data_dir)
    if not root.is_dir():
        return []
    return [(d, load_case(d)) for d in sorted(root.iterdir()) if (d / "gold.json").is_file()]


def add_audio(data_dir: str | Path, audio: Path, case_id: str) -> Path:
    """Copy a recording into a new case folder and return the folder."""
    case_dir = cases_dir(data_dir) / case_id
    if case_dir.exists():
        raise FileExistsError(f"case {case_id!r} already exists")
    case_dir.mkdir(parents=True)
    shutil.copy2(audio, case_dir / f"audio{audio.suffix.lower()}")
    return case_dir
