import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";

let dataDir;
let app;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "crumbly-test-"));
  app = await createApp({
    dataDir,
    demoMode: true,
    publicBaseUrl: "https://crumbly.example"
  });
});

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("Crumbly API", () => {
  it("processes an uploaded recording into an editable draft", async () => {
    const response = await request(app)
      .post("/api/process")
      .attach("audio", Buffer.from("demo"), "recipe.webm")
      .expect(200);

    expect(response.body.draft).toMatchObject({
      sourceLanguage: "Hindi",
      name: "Aloo Gobi",
      servings: 4
    });
    expect(response.body.draft.ingredients).toHaveLength(6);
    expect(response.body.draft.ingredients[0].id).toMatch(
      /^[0-9a-f-]{36}$/
    );
  });

  it("publishes a recipe page and a downloadable .crumb file", async () => {
    const processResponse = await request(app)
      .post("/api/process")
      .attach("audio", Buffer.from("demo"), "recipe.webm")
      .expect(200);

    const publishResponse = await request(app)
      .post("/api/recipes")
      .send(processResponse.body.draft)
      .expect(201);

    expect(publishResponse.body.url).toMatch(
      /^https:\/\/crumbly\.example\/r\//
    );

    const slug = publishResponse.body.recipe.slug;
    const pageResponse = await request(app).get(`/r/${slug}`).expect(200);
    expect(pageResponse.text).toContain('"@type":"Recipe"');
    expect(pageResponse.text).toContain("<h1>Aloo Gobi</h1>");

    const crumbResponse = await request(app)
      .get(`/api/recipes/${slug}/crumb`)
      .expect(200);
    const crumb = JSON.parse(crumbResponse.text);
    expect(crumb.name).toBe("Aloo Gobi");
    expect(crumb.ingredients).toHaveLength(6);
    expect(crumb.steps).toHaveLength(4);
  });

  it("rejects unsupported files and missing recipe fields", async () => {
    await request(app)
      .post("/api/process")
      .attach("audio", Buffer.from("demo"), "recipe.txt")
      .expect(400);

    const response = await request(app)
      .post("/api/recipes")
      .send({ name: "" })
      .expect(400);
    expect(response.body.error).toContain("incomplete");
  });
});
