"""Where shared recipes live. They expire one hour after they are first saved."""

import os
import re
import secrets
import tempfile
from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from rcpy.config import Settings
from rcpy.draft import RecipeDraft, StoredRecipe

SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
TTL = timedelta(hours=1)


class Store(ABC):
    """save / get / update are shared; subclasses only read, write and delete one row."""

    @abstractmethod
    def _read(self, slug: str) -> StoredRecipe | None: ...

    @abstractmethod
    def _write(self, recipe: StoredRecipe) -> None: ...

    @abstractmethod
    def _delete(self, slug: str) -> None: ...

    def save(self, draft: RecipeDraft) -> StoredRecipe:
        now = datetime.now(UTC)
        stored = StoredRecipe.model_validate(
            {
                **draft.model_dump(),
                "slug": secrets.token_urlsafe(9),  # 12 url-safe chars
                "uuid": uuid4(),
                "created_at": now,
                "updated_at": now,
                "expires_at": now + TTL,
            }
        )
        self._write(stored)
        return stored

    def get(self, slug: str) -> StoredRecipe | None:
        if not SLUG_RE.match(slug):  # also stops path tricks like "../x"
            return None
        recipe = self._read(slug)
        if recipe and recipe.expires_at <= datetime.now(UTC):
            self._delete(slug)
            return None
        return recipe

    def update(self, slug: str, draft: RecipeDraft) -> StoredRecipe | None:
        existing = self.get(slug)
        if existing is None:
            return None
        stored = StoredRecipe.model_validate(
            {
                **draft.model_dump(),
                "slug": existing.slug,
                "uuid": existing.uuid,
                "created_at": existing.created_at,
                "updated_at": datetime.now(UTC),
                "expires_at": existing.expires_at,  # editing does not extend the link
            }
        )
        self._write(stored)
        return stored


class FileStore(Store):
    def __init__(self, directory: Path):
        self.dir = directory
        self.dir.mkdir(parents=True, exist_ok=True)

    def _path(self, slug: str) -> Path:
        return self.dir / f"{slug}.json"

    def _read(self, slug: str) -> StoredRecipe | None:
        try:
            return StoredRecipe.model_validate_json(self._path(slug).read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None

    def _write(self, recipe: StoredRecipe) -> None:
        # write to a temp file then rename, so a reader never sees half a file
        fd, tmp = tempfile.mkstemp(dir=self.dir, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(recipe.model_dump_json(by_alias=True, indent=2))
        os.replace(tmp, self._path(recipe.slug))

    def _delete(self, slug: str) -> None:
        self._path(slug).unlink(missing_ok=True)


class PostgresStore(Store):
    """Same table the old Node app used, so an existing Neon database keeps working."""

    def __init__(self, url: str):
        self.url = url
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rcpy_recipes (
                    slug TEXT PRIMARY KEY,
                    recipe JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            conn.execute("DELETE FROM rcpy_recipes WHERE expires_at <= NOW()")

    def _connect(self):
        import psycopg

        # One short-lived connection per call suits serverless hosts.
        return psycopg.connect(self.url, autocommit=True)

    def _read(self, slug: str) -> StoredRecipe | None:
        with self._connect() as conn:
            row = conn.execute("SELECT recipe FROM rcpy_recipes WHERE slug = %s", (slug,)).fetchone()
        return StoredRecipe.model_validate(row[0]) if row else None

    def _write(self, recipe: StoredRecipe) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO rcpy_recipes (slug, recipe, created_at, updated_at, expires_at)
                VALUES (%s, %s::jsonb, %s, %s, %s)
                ON CONFLICT (slug) DO UPDATE
                SET recipe = EXCLUDED.recipe,
                    updated_at = EXCLUDED.updated_at,
                    expires_at = EXCLUDED.expires_at
                """,
                (
                    recipe.slug,
                    recipe.model_dump_json(by_alias=True),
                    recipe.created_at,
                    recipe.updated_at,
                    recipe.expires_at,
                ),
            )

    def _delete(self, slug: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM rcpy_recipes WHERE slug = %s", (slug,))


def get_store(settings: Settings) -> Store:
    if settings.database_url:
        return PostgresStore(settings.database_url)
    return FileStore(Path(settings.data_dir) / "recipes")
