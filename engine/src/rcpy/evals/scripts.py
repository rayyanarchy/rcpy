"""Dictation scripts: recipes written to be read aloud, with their answer key built in.

Each `evals/scripts/<id>.md` has front matter (id, title, speaker, language,
tags), the text to read under "## Say this", and the gold recipe as a fenced
JSON block. A recording named after its script (`<id>.m4a`, or
`<id>--<speaker>.m4a` when several people read it) becomes a reviewed case
with no labelling.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path

from rcpy.evals.gold import GoldCase, GoldRecipe

FRONT_MATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)
SAY_THIS = re.compile(r"^## Say this\n(.*?)^## ", re.S | re.M)
ANSWER = re.compile(r"```json\n(.*?)\n```", re.S)


@dataclass
class Script:
    id: str
    title: str
    speaker: str
    language: str
    tags: list[str]
    length: str  # e.g. "about 1.5 min"
    text: str  # what is read aloud
    recipe: GoldRecipe

    def to_case(self, case_id: str, speaker: str | None = None) -> GoldCase:
        return GoldCase(
            id=case_id,
            reviewed=True,  # the script is the answer; edit gold.json if the reader changed an amount
            language=self.language,
            speaker=speaker or self.speaker,
            tags=[*self.tags, "scripted"],
            script=self.id,
            recipe=self.recipe,
        )


def parse_script(path: Path) -> Script:
    source = path.read_text(encoding="utf-8")
    front = FRONT_MATTER.match(source)
    say = SAY_THIS.search(source)
    answer = ANSWER.search(source)
    if not (front and say and answer):
        raise ValueError(f"{path.name}: needs front matter, a '## Say this' section and a ```json answer key")
    meta = dict(line.split(": ", 1) for line in front.group(1).splitlines() if ": " in line)
    tags = [t.strip() for t in meta.get("tags", "").strip("[]").split(",") if t.strip()]
    return Script(
        id=meta["id"],
        title=meta.get("title", meta["id"]),
        speaker=meta.get("speaker", ""),
        language=meta.get("language", ""),
        tags=tags,
        length=meta.get("length", ""),
        text=say.group(1).strip(),
        recipe=GoldRecipe.model_validate(json.loads(answer.group(1))),
    )


def load_scripts(directory: Path) -> dict[str, Script]:
    if not directory.is_dir():
        return {}
    scripts = [parse_script(p) for p in sorted(directory.glob("*.md")) if p.name != "README.md"]
    return {s.id: s for s in scripts}


def match_recording(stem: str) -> tuple[str, str | None]:
    """`khatti-dal--mom` -> ("khatti-dal", "mom"); `khatti-dal` -> ("khatti-dal", None)."""
    script_id, _, speaker = stem.lower().partition("--")
    return script_id, speaker or None
