"""Vercel entrypoint: the engine's FastAPI app as a single Python function.

vercel.json rewrites /api/*, /r/* and /health here and passes the path that was
requested in `__rcpy_path`; the middleware below restores it so the app's
routes match as they do under `rcpy serve`.
"""

import os
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine" / "src"))

# Without a database, shared recipes would go to a per-instance temp folder:
# processing still works, but share links only resolve on the instance that saved them.
if not os.environ.get("DATABASE_URL"):
    os.environ.setdefault("DATA_DIR", "/tmp/rcpy")

from rcpy.api import create_app  # noqa: E402


class OriginalPath:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            query = parse_qsl(scope.get("query_string", b"").decode(), keep_blank_values=True)
            path = next((value for key, value in query if key == "__rcpy_path"), None)
            if path:
                rest = urlencode([(key, value) for key, value in query if key != "__rcpy_path"])
                scope = {**scope, "path": path, "raw_path": path.encode(), "query_string": rest.encode()}
        await self.app(scope, receive, send)


app = create_app()
app.add_middleware(OriginalPath)
