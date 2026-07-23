async function request(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" && body?.error
        ? body.error
        : "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return body;
}

export async function processAudio(file) {
  const data = new FormData();
  data.append("audio", file);
  return request("/api/process", {
    method: "POST",
    body: data
  });
}

export async function publishRecipe(draft, slug = "") {
  return request(slug ? `/api/recipes/${slug}` : "/api/recipes", {
    method: slug ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(draft)
  });
}
