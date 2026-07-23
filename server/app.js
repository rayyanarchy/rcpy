import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import multer from "multer";
import { processAudio } from "./ai.js";
import { getConfig } from "./config.js";
import {
  getBaseUrl,
  recipeToCrumb,
  renderRecipePage
} from "./formatters.js";
import { recipeDraftSchema } from "./recipe-schema.js";
import {
  ensureStorage,
  getRecipe,
  saveRecipe,
  updateRecipe
} from "./storage.js";

const allowedExtensions = new Set([
  ".flac",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".m4a",
  ".ogg",
  ".wav",
  ".webm"
]);

function createUpload(config) {
  return multer({
    dest: path.join(config.dataDir, "uploads"),
    limits: { fileSize: config.maxAudioMb * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(
        allowedExtensions.has(extension)
          ? null
          : new multer.MulterError("LIMIT_UNEXPECTED_FILE", "audio"),
        allowedExtensions.has(extension)
      );
    }
  });
}

function withIds(result) {
  return {
    ...result.extraction,
    originalTranscript: result.originalTranscript,
    ingredients: result.extraction.ingredients.map((item) => ({
      ...item,
      id: crypto.randomUUID()
    })),
    steps: result.extraction.steps.map((step) => ({
      ...step,
      id: crypto.randomUUID()
    }))
  };
}

export async function createApp(overrides = {}) {
  const config = getConfig(overrides);
  await ensureStorage(config.dataDir);
  const upload = createUpload(config);
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/process", upload.single("audio"), async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: "Choose an audio file first." });
    }

    try {
      const result = await processAudio(req.file.path, req.file.mimetype, config);
      res.json({ draft: withIds(result) });
    } catch (error) {
      next(error);
    } finally {
      await fs.rm(req.file.path, { force: true }).catch(() => {});
    }
  });

  app.post("/api/recipes", async (req, res, next) => {
    try {
      const draft = recipeDraftSchema.parse(req.body);
      const recipe = await saveRecipe(config.dataDir, draft);
      const baseUrl = getBaseUrl(req, config.publicBaseUrl);
      res.status(201).json({
        recipe,
        url: `${baseUrl}/r/${recipe.slug}`,
        crumbUrl: `${baseUrl}/api/recipes/${recipe.slug}/crumb`
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/recipes/:slug", async (req, res, next) => {
    try {
      const recipe = await getRecipe(config.dataDir, req.params.slug);
      if (!recipe) return res.status(404).json({ error: "Recipe not found." });
      res.json({ recipe });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/recipes/:slug", async (req, res, next) => {
    try {
      const draft = recipeDraftSchema.parse(req.body);
      const recipe = await updateRecipe(config.dataDir, req.params.slug, draft);
      if (!recipe) return res.status(404).json({ error: "Recipe not found." });
      const baseUrl = getBaseUrl(req, config.publicBaseUrl);
      res.json({
        recipe,
        url: `${baseUrl}/r/${recipe.slug}`,
        crumbUrl: `${baseUrl}/api/recipes/${recipe.slug}/crumb`
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/recipes/:slug/crumb", async (req, res, next) => {
    try {
      const recipe = await getRecipe(config.dataDir, req.params.slug);
      if (!recipe) return res.status(404).json({ error: "Recipe not found." });
      const baseUrl = getBaseUrl(req, config.publicBaseUrl);
      const crumb = recipeToCrumb(recipe, baseUrl);
      const fileName =
        recipe.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") ||
        "recipe";
      res
        .attachment(`${fileName}.crumb`)
        .type("application/json")
        .send(JSON.stringify(crumb));
    } catch (error) {
      next(error);
    }
  });

  app.get("/r/:slug", async (req, res, next) => {
    try {
      const recipe = await getRecipe(config.dataDir, req.params.slug);
      if (!recipe) {
        return res
          .status(404)
          .type("html")
          .send("<h1>Recipe not found</h1>");
      }
      const baseUrl = getBaseUrl(req, config.publicBaseUrl);
      res.type("html").send(renderRecipePage(recipe, baseUrl));
    } catch (error) {
      next(error);
    }
  });

  const distPath = path.resolve(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*splat", async (req, res, next) => {
    try {
      await fs.access(path.join(distPath, "index.html"));
      res.sendFile(path.join(distPath, "index.html"));
    } catch {
      next();
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `Audio files must be ${config.maxAudioMb} MB or smaller.`
          : "Use an MP3, M4A, WAV, MP4, OGG, FLAC, or WebM audio file.";
      return res.status(400).json({ error: message });
    }

    if (error?.name === "ZodError") {
      return res.status(400).json({
        error: "Some recipe fields are incomplete or invalid.",
        details: error.issues
      });
    }

    console.error(error);
    res
      .status(error.status || 500)
      .json({ error: error.message || "Something went wrong." });
  });

  return app;
}
