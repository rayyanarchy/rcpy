import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { storedRecipeSchema } from "./recipe-schema.js";

function recipePath(dataDir, slug) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) {
    return null;
  }
  return path.join(dataDir, "recipes", `${slug}.json`);
}

export async function ensureStorage(dataDir) {
  await fs.mkdir(path.join(dataDir, "recipes"), { recursive: true });
  await fs.mkdir(path.join(dataDir, "uploads"), { recursive: true });
}

export async function saveRecipe(dataDir, draft) {
  await ensureStorage(dataDir);
  const now = new Date().toISOString();
  const stored = storedRecipeSchema.parse({
    ...draft,
    slug: crypto.randomBytes(9).toString("base64url"),
    uuid: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  });
  await writeRecipe(dataDir, stored);
  return stored;
}

export async function updateRecipe(dataDir, slug, draft) {
  const existing = await getRecipe(dataDir, slug);
  if (!existing) return null;

  const stored = storedRecipeSchema.parse({
    ...draft,
    slug: existing.slug,
    uuid: existing.uuid,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  });
  await writeRecipe(dataDir, stored);
  return stored;
}

async function writeRecipe(dataDir, recipe) {
  const target = recipePath(dataDir, recipe.slug);
  const temporary = `${target}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(recipe, null, 2), "utf8");
  await fs.rename(temporary, target);
}

export async function getRecipe(dataDir, slug) {
  const target = recipePath(dataDir, slug);
  if (!target) return null;

  try {
    const raw = await fs.readFile(target, "utf8");
    return storedRecipeSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
