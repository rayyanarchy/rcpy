import path from "node:path";

const toBoolean = (value) => String(value).toLowerCase() === "true";
const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function getConfig(overrides = {}) {
  const root = process.cwd();
  const runningOnVercel = process.env.VERCEL === "1";
  const configuredDataDir =
    overrides.dataDir ?? process.env.DATA_DIR ?? (runningOnVercel ? "/tmp/crumbly" : "./data");

  return {
    port: Number(overrides.port ?? process.env.PORT ?? 3000),
    dataDir: path.resolve(
      root,
      configuredDataDir
    ),
    databaseUrl: overrides.databaseUrl ?? process.env.DATABASE_URL ?? "",
    publicBaseUrl:
      overrides.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? "",
    maxAudioMb: toPositiveNumber(
      overrides.maxAudioMb ?? process.env.MAX_AUDIO_MB,
      50
    ),
    demoMode:
      overrides.demoMode ??
      toBoolean(process.env.DEMO_MODE ?? "false"),
    geminiApiKey:
      overrides.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "",
    geminiModel:
      overrides.geminiModel ??
      process.env.GEMINI_MODEL ??
      "gemini-3.5-flash-lite"
  };
}
