import type { ProcessEvent, PublishResponse, RecipeDraft } from "./types";

const FALLBACK = "Something went wrong. Please try again.";

export class ApiError extends Error {}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError("Could not reach RCPY. Check your connection and try again.");
  }
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const body: unknown = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    // The engine always answers errors with {"error": "..."}.
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : response.status === 413
          ? "That recording is too large. Try a shorter one."
          : FALLBACK;
    throw new ApiError(message);
  }
  return body as T;
}

/**
 * Upload audio and follow the pipeline's progress. Resolves with the draft;
 * `onEvent` sees every plan/stage event as it arrives.
 */
export async function processAudio(
  file: File,
  onEvent: (event: ProcessEvent) => void,
  signal?: AbortSignal,
): Promise<RecipeDraft> {
  const body = new FormData();
  body.append("audio", file);
  let response: Response;
  try {
    response = await fetch("/api/process?stream=true", { method: "POST", body, signal });
  } catch (caught) {
    if (signal?.aborted) throw caught;
    throw new ApiError("Could not reach RCPY. Check your connection and try again.");
  }
  if (!response.ok || !response.body) {
    // Validation errors (bad type, too large, rate limit) arrive before streaming starts.
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.error ?? FALLBACK);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as ProcessEvent;
      if (event.event === "draft") return event.draft;
      if (event.event === "error") throw new ApiError(event.error);
      onEvent(event);
    }
    if (done) break;
  }
  throw new ApiError(FALLBACK);
}

export function publishRecipe(draft: RecipeDraft, slug?: string): Promise<PublishResponse> {
  return request<PublishResponse>(slug ? `/api/recipes/${slug}` : "/api/recipes", {
    method: slug ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(draft),
  });
}
