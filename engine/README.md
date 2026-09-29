# rcpy engine

Python engine + CLI for RCPY. Turns a dictated recipe (audio file) into a structured recipe.

```bash
uv sync
cp ../.env.example ../.env   # add GEMINI_API_KEY (or set DEMO_MODE=true)
uv run rcpy parse recipe.m4a -f json,md,html -o out/
uv run pytest
```
