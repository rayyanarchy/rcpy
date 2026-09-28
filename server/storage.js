import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { storedRecipeSchema } from "./recipe-schema.js";

function recipePath(dataDir, slug) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) {
    return null;
  }
  return path.join(dataDir, "recipes", `${slug}.json`);
}

function database(config) {
  return config.databaseUrl ? neon(config.databaseUrl) : null;
}

async function ensureDatabase(sql) {
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crumbly_recipes')
         AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rcpy_recipes') THEN
        ALTER TABLE crumbly_recipes RENAME TO rcpy_recipes;
      END IF;
    END $$;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rcpy_recipes (
      slug TEXT PRIMARY KEY,
      recipe JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    ALTER TABLE rcpy_recipes
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
  `;
  await sql`
    UPDATE rcpy_recipes
    SET expires_at = NOW()
    WHERE expires_at IS NULL
  `;
  await sql`
    DELETE FROM rcpy_recipes WHERE expires_at <= NOW()
  `;
}

export async function ensureStorage(config) {
  const sql = database(config);
  if (sql) return ensureDatabase(sql);

  await fs.mkdir(path.join(config.dataDir, "recipes"), { recursive: true });
  await fs.mkdir(path.join(config.dataDir, "uploads"), { recursive: true });
}

export async function saveRecipe(config, draft) {
  await ensureStorage(config);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const stored = storedRecipeSchema.parse({
    ...draft,
    slug: crypto.randomBytes(9).toString("base64url"),
    uuid: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    expiresAt
  });
  await writeRecipe(config, stored);
  return stored;
}

export async function updateRecipe(config, slug, draft) {
  const existing = await getRecipe(config, slug);
  if (!existing) return null;

  const stored = storedRecipeSchema.parse({
    ...draft,
    slug: existing.slug,
    uuid: existing.uuid,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    expiresAt: existing.expiresAt
  });
  await writeRecipe(config, stored);
  return stored;
}

async function writeRecipe(config, recipe) {
  const sql = database(config);
  if (sql) {
    await sql`
      INSERT INTO rcpy_recipes (slug, recipe, created_at, updated_at, expires_at)
      VALUES (${recipe.slug}, ${JSON.stringify(recipe)}::jsonb, ${recipe.createdAt}, ${recipe.updatedAt}, ${recipe.expiresAt})
      ON CONFLICT (slug) DO UPDATE
      SET recipe = EXCLUDED.recipe,
          updated_at = EXCLUDED.updated_at,
          expires_at = EXCLUDED.expires_at
    `;
    return;
  }

  const target = recipePath(config.dataDir, recipe.slug);
  const temporary = `${target}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(recipe, null, 2), "utf8");
  await fs.rename(temporary, target);
}

export async function getRecipe(config, slug) {
  if (!recipePath(config.dataDir, slug)) return null;

  const sql = database(config);
  if (sql) {
    await sql`
      DELETE FROM rcpy_recipes
      WHERE slug = ${slug} AND expires_at <= NOW()
    `;
    const rows = await sql`
      SELECT recipe
      FROM rcpy_recipes
      WHERE slug = ${slug} AND expires_at > NOW()
      LIMIT 1
    `;
    return rows[0] ? storedRecipeSchema.parse(rows[0].recipe) : null;
  }

  const target = recipePath(config.dataDir, slug);

  try {
    const raw = await fs.readFile(target, "utf8");
    const recipe = storedRecipeSchema.parse(JSON.parse(raw));
    if (Date.parse(recipe.expiresAt) <= Date.now()) {
      await fs.rm(target, { force: true });
      return null;
    }
    return recipe;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
