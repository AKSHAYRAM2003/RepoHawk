"""
Rate Limiting Service (commit 5)

A simple in-process token-bucket rate limiter. Per-IP + per-session bucket.

For dev/demo this is fine. In production you'd want a Redis-backed implementation
so all workers share the same bucket. The interface is intentionally simple so
the production backend can be swapped in without API changes.
"""
import time
import threading
import logging
from typing import Tuple

logger = logging.getLogger("repohawk.rate_limit")


class TokenBucket:
    """A single token bucket. Refills at `rate` tokens/sec, capacity `capacity`."""

    def __init__(self, capacity: int, refill_rate_per_sec: float):
        self.capacity = capacity
        self.rate = refill_rate_per_sec
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()
        self._lock = threading.Lock()

    def try_consume(self, tokens: int = 1) -> Tuple[bool, float]:
        """
        Try to consume `tokens` from the bucket. Returns (allowed, retry_after_secs).
        If not allowed, retry_after_secs is the time until the bucket has enough tokens.
        """
        with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_refill = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True, 0.0

            # Compute retry-after
            deficit = tokens - self.tokens
            retry_after = deficit / self.rate
            return False, retry_after


class RateLimiter:
    """
    Per-key rate limiter. Default: 10 requests per 60 seconds.

    Configurable via env later if needed. For now the defaults are:
      - chat: 10 requests / 60 seconds per (IP, session_id) bucket
    """

    def __init__(self, capacity: int = 10, refill_per_sec: float = 10 / 60):
        self.capacity = capacity
        self.refill_per_sec = refill_per_sec
        self._buckets: dict = {}
        self._lock = threading.Lock()

    def _bucket_for(self, key: str) -> TokenBucket:
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = TokenBucket(self.capacity, self.refill_per_sec)
                self._buckets[key] = bucket
            return bucket

    def check(self, key: str) -> Tuple[bool, float]:
        """Returns (allowed, retry_after_secs)."""
        bucket = self._bucket_for(key)
        return bucket.try_consume()

    def cleanup(self, max_age_secs: float = 3600):
        """Remove stale buckets (called periodically to bound memory)."""
        now = time.monotonic()
        with self._lock:
            stale = [
                k for k, b in self._buckets.items()
                if (now - b.last_refill) > max_age_secs
            ]
            for k in stale:
                self._buckets.pop(k, None)


# Module-level singleton for chat. 10 req / 60 sec per (ip, session).
chat_limiter = RateLimiter(capacity=10, refill_per_sec=10 / 60)
