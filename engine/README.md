# rcpy engine

The Python side of RCPY: a library that turns recipe audio into a structured recipe, the `rcpy` CLI (`parse`, `serve`, `eval`), and the FastAPI app the web app talks to.

```bash
uv sync --all-extras
uv run rcpy parse data/raw/recipe.m4a -f md   # needs GEMINI_API_KEY in ../.env, or DEMO_MODE=true
uv run rcpy serve                             # API (and the built web app) on http://127.0.0.1:3000
uv run pytest
```

- How it fits together: [../docs/architecture.md](../docs/architecture.md)
- Day-to-day development: [../docs/development.md](../docs/development.md)
- HTTP API: [../docs/api.md](../docs/api.md)
- Evals: [evals/README.md](evals/README.md)
