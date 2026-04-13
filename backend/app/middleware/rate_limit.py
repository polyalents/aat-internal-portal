"""
Simple rate limiter for login endpoint using Redis.
Limits: 5 attempts per 5 minutes per IP.
"""

import logging
from datetime import timedelta

import redis.asyncio as aioredis
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)

RATE_LIMIT_REQUESTS = 5
RATE_LIMIT_WINDOW = timedelta(minutes=5)
RATE_LIMITED_PATHS = {"/api/auth/login"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self.redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis | None:
        if self.redis is None:
            try:
                self.redis = aioredis.from_url(
                    settings.redis_url,
                    decode_responses=True,
                )
                await self.redis.ping()
            except Exception:
                logger.warning("Redis not available for rate limiting")
                self.redis = None
        return self.redis

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method != "POST" or request.url.path not in RATE_LIMITED_PATHS:
            return await call_next(request)

        redis_client = await self._get_redis()
        if redis_client is None:
            return await call_next(request)

        client_ip = (
            request.headers.get("X-Real-IP")
            or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )

        username = "_"
        try:
            body = await request.body()
            if body:
                payload = json.loads(body)
                if isinstance(payload, dict) and isinstance(payload.get("username"), str):
                    username = payload["username"].strip().lower()[:100] or "_"
        except Exception:
            username = "_"

        key = f"rate_limit:login:{client_ip}:{username}"

        try:
            current = await redis_client.get(key)
            if current is not None and int(current) >= RATE_LIMIT_REQUESTS:
                ttl = await redis_client.ttl(key)
                if ttl is None or ttl < 0:
                    ttl = int(RATE_LIMIT_WINDOW.total_seconds())

                logger.warning("Rate limit exceeded for IP %s", client_ip)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Too many login attempts. Try again in {ttl} seconds."
                    },
                )

            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, int(RATE_LIMIT_WINDOW.total_seconds()))
            await pipe.execute()

        except Exception:
            logger.exception("Rate limit check failed")

        return await call_next(request)