"""
Async Redis Client & Connection Management
Provides shared connection pooling for task queues, rate limiting, and pub/sub.
"""

import logging
from typing import Optional
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("repohawk.redis")

_redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> aioredis.Redis:
    """Return a singleton async Redis client connected to the configured pool."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
            )
            logger.info("Initialized Async Redis connection pool")
        except Exception as e:
            logger.error(f"Failed to initialize Redis pool: {e}")
            raise
    return _redis_client


async def check_redis_health() -> bool:
    """Check if Redis broker is reachable."""
    try:
        client = await get_redis_client()
        return await client.ping()
    except Exception as err:
        logger.warning(f"Redis health check failed: {err}")
        return False


async def close_redis():
    """Close the global Redis connection pool cleanly."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Closed Redis connection pool")
