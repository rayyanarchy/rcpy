import { createApp } from "../server/app.js";

let appPromise;

function restoreOriginalPath(req) {
  const requestUrl = new URL(req.url, "https://rcpy.local");
  const originalPath =
    requestUrl.searchParams.get("__rcpy_path") ||
    requestUrl.searchParams.get("__crumbly_path");
  if (!originalPath) return;

  requestUrl.searchParams.delete("__rcpy_path");
  requestUrl.searchParams.delete("__crumbly_path");
  req.url = `${originalPath}${requestUrl.search}`;
}

export default async function handler(req, res) {
  restoreOriginalPath(req);
  appPromise ??= createApp();
  const app = await appPromise;
  return app(req, res);
}
