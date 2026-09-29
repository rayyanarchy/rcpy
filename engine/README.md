# rcpy engine

Python engine + CLI for RCPY. Turns a dictated recipe (audio file) into a structured recipe.

```bash
uv sync
cp ../.env.example ../.env   # add GEMINI_API_KEY (or set DEMO_MODE=true)
# put recordings in data/raw/; outputs go to data/out/
uv run rcpy parse data/raw/recipe.m4a -f json,md,html -o data/out/
uv run pytest
```
