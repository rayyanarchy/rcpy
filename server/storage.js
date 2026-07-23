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
    CREATE TABLE IF NOT EXISTS crumbly_recipes (
      slug TEXT PRIMARY KEY,
      recipe JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
  const stored = storedRecipeSchema.parse({
    ...draft,
    slug: crypto.randomBytes(9).toString("base64url"),
    uuid: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
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
    updatedAt: new Date().toISOString()
  });
  await writeRecipe(config, stored);
  return stored;
}

async function writeRecipe(config, recipe) {
  const sql = database(config);
  if (sql) {
    await sql`
      INSERT INTO crumbly_recipes (slug, recipe, created_at, updated_at)
      VALUES (${recipe.slug}, ${JSON.stringify(recipe)}::jsonb, ${recipe.createdAt}, ${recipe.updatedAt})
      ON CONFLICT (slug) DO UPDATE
      SET recipe = EXCLUDED.recipe, updated_at = EXCLUDED.updated_at
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
    const rows = await sql`
      SELECT recipe FROM crumbly_recipes WHERE slug = ${slug} LIMIT 1
    `;
    return rows[0] ? storedRecipeSchema.parse(rows[0].recipe) : null;
  }

  const target = recipePath(config.dataDir, slug);

  try {
    const raw = await fs.readFile(target, "utf8");
    return storedRecipeSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
