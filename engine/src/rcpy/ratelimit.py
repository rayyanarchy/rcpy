"""Tiny in-memory rate limiter, used as a FastAPI dependency.

State lives in one process, like the old express-rate-limit memory store: fine
for one server, only approximate across many serverless instances.
"""

import time

from fastapi import HTTPException, Request


def client_ip(request: Request) -> str:
    # Behind one proxy (Vercel etc.) the proxy appends the real client IP last.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float, message: str):
        self.limit = limit
        self.window = window_seconds
        self.message = message
        self._hits: dict[str, list[float]] = {}

    def __call__(self, request: Request) -> None:
        ip = client_ip(request)
        now = time.monotonic()
        recent = [t for t in self._hits.get(ip, []) if now - t < self.window]
        if len(recent) >= self.limit:
            self._hits[ip] = recent
            raise HTTPException(status_code=429, detail=self.message)
        recent.append(now)
        self._hits[ip] = recent
