"""
Redis Sliding-Window Rate Limiter & Cost Protection Guardrails
Protects external LLM token budget and prevents infrastructure denial-of-service.
"""

import time
import logging
from typing import Optional, Callable
from fastapi import HTTPException, Request, status
import httpx

from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger("repohawk.rate_limit")


class RateLimiter:
    """
    Sliding window rate limiter backed by Redis sorted sets (ZSET).
    Falls back gracefully if Redis is temporarily unreachable in dev mode.
    """

    def __init__(self, limit: int, window_seconds: int, scope: str = "global"):
        self.limit = limit
        self.window_seconds = window_seconds
        self.scope = scope

    async def __call__(self, request: Request):
        # Extract user identifier (from JWT session user, cookie, or client IP)
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            # Check headers or fallback to IP
            client_ip = request.client.host if request.client else "unknown_ip"
            identifier = f"ip:{client_ip}"
        else:
            identifier = f"user:{user_id}"

        key = f"repohawk:ratelimit:{self.scope}:{identifier}"
        now = time.time()
        window_start = now - self.window_seconds

        try:
            redis = await get_redis_client()
            async with redis.pipeline(transaction=True) as pipe:
                # 1. Clean entries older than current window
                pipe.zremrangebyscore(key, 0, window_start)
                # 2. Count remaining calls in window
                pipe.zcard(key)
                # 3. Retrieve oldest call score to accurately determine comeback time
                pipe.zrange(key, 0, 0, withscores=True)
                results = await pipe.execute()

            call_count = results[1]
            oldest_entries = results[2]

            if call_count >= self.limit:
                if oldest_entries:
                    oldest_score = float(oldest_entries[0][1])
                    retry_after = max(1, int(oldest_score + self.window_seconds - now))
                else:
                    retry_after = int(self.window_seconds)

                logger.warning(
                    f"Rate limit exceeded for {identifier} on scope '{self.scope}' "
                    f"({call_count}/{self.limit} reqs). Rejected with HTTP 429. Retry-After: {retry_after}s"
                )
                window_desc = f"{self.window_seconds // 3600} hours" if self.window_seconds >= 3600 else f"{self.window_seconds}s"
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Analysis credit limit reached. Maximum {self.limit} repositories per {window_desc}.",
                    headers={"Retry-After": str(retry_after)},
                )

            # Within limit: record this call
            async with redis.pipeline(transaction=True) as pipe:
                pipe.zadd(key, {str(now): now})
                pipe.expire(key, self.window_seconds + 5)
                await pipe.execute()

        except HTTPException:
            raise
        except Exception as redis_err:
            # Defensive degradation: allow request if Redis is offline
            logger.debug(f"Redis rate limiter bypassed: {redis_err}")
            return


# Standard pre-configured limiters (4-hour window, 5 credits)
repo_analysis_limiter = RateLimiter(
    limit=getattr(settings, "RATE_LIMIT_ANALYSIS_PER_WINDOW", 5),
    window_seconds=getattr(settings, "RATE_LIMIT_ANALYSIS_WINDOW_SECONDS", 14400),
    scope="repo_analysis",
)

chat_message_limiter = RateLimiter(
    limit=settings.RATE_LIMIT_CHAT_PER_MINUTE,
    window_seconds=60,
    scope="chat_completion",
)


async def validate_repo_size_limit(github_url: str):
    """
    Query GitHub API repository metadata before cloning.
    Rejects repositories that exceed MAX_REPO_SIZE_MB to protect server disk & memory.
    """
    parts = github_url.rstrip("/").split("/")
    if len(parts) < 2:
        return

    owner, repo_name = parts[-2], parts[-1]
    api_url = f"https://api.github.com/repos/{owner}/{repo_name}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(api_url, headers={"User-Agent": "RepoHawk-Validator"})
            if resp.status_code == 200:
                data = resp.json()
                size_kb = data.get("size", 0)
                size_mb = size_kb / 1024.0

                if size_mb > settings.MAX_REPO_SIZE_MB:
                    logger.warning(f"Rejected repo {owner}/{repo_name}: size {size_mb:.1f} MB exceeds {settings.MAX_REPO_SIZE_MB} MB limit.")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Repository is too large ({size_mb:.1f} MB). "
                            f"Free tier limit is {settings.MAX_REPO_SIZE_MB} MB."
                        ),
                    )
    except HTTPException:
        raise
    except Exception as err:
        logger.debug(f"Pre-clone size check skipped (non-blocking): {err}")
