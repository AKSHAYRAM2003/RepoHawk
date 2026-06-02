"""
RepoHawk Embeddings Client
Uses direct HTTP calls to OpenRouter's embeddings endpoint.
LangChain's OpenAIEmbeddings client is NOT used here because it applies
tokenizer-based chunking that is incompatible with OpenRouter's API contract.

Improvements in this iteration:
  - LRU cache for repeated queries (commit 4)
  - Same model, same dimension, same key — cache key is the question text
"""

import hashlib
import logging
import threading
from collections import OrderedDict
from typing import List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("repohawk.embeddings")


class _LRUCache:
    """Thread-safe LRU cache."""

    def __init__(self, capacity: int = 256):
        self.capacity = capacity
        self._lock = threading.Lock()
        self._data: "OrderedDict[str, List[float]]" = OrderedDict()

    def get(self, key: str) -> Optional[List[float]]:
        with self._lock:
            if key not in self._data:
                return None
            self._data.move_to_end(key)
            return self._data[key]

    def set(self, key: str, value: List[float]) -> None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = value
            while len(self._data) > self.capacity:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)


# Process-wide cache. Default 256 entries (~256KB for 2048-dim float vectors).
_query_cache = _LRUCache(capacity=256)


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


class OpenRouterEmbeddings:
    """
    Thin wrapper for OpenRouter's /v1/embeddings endpoint.
    Generates text embedding vectors via the configured MODEL_EMBED.
    """

    def __init__(self, *, use_cache: bool = True, cache_capacity: int = 256):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
        self.model = settings.MODEL_EMBED
        self.timeout = 60
        self._use_cache = use_cache
        # If a custom capacity is requested, replace the global cache
        # with a new instance scoped to this embeddings client.
        if cache_capacity != 256:
            self._local_cache = _LRUCache(capacity=cache_capacity)
        else:
            self._local_cache = _query_cache

    def _call_api(self, texts: List[str]) -> List[List[float]]:
        """Makes a single HTTP POST to the embeddings endpoint."""
        resp = httpx.post(
            f"{self.base_url}/embeddings",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={"model": self.model, "input": texts},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        data = resp.json()

        embedding_data = data.get("data", [])
        if not embedding_data:
            raise ValueError(f"No embedding data received from OpenRouter. Response: {data}")

        embedding_data.sort(key=lambda x: x.get("index", 0))
        return [item["embedding"] for item in embedding_data]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of document texts. (No cache — document embeddings are usually unique.)"""
        return self._call_api(texts)

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query string. Uses the LRU cache."""
        if self._use_cache:
            key = _cache_key(text)
            cached = self._local_cache.get(key)
            if cached is not None:
                logger.debug(f"embeddings: cache HIT for {text[:40]!r}")
                return cached
            logger.debug(f"embeddings: cache MISS for {text[:40]!r}")
            vec = self._call_api([text])[0]
            self._local_cache.set(key, vec)
            return vec
        return self._call_api([text])[0]

    def cache_stats(self) -> dict:
        """Return basic cache stats (for debugging/telemetry)."""
        return {
            "size": len(self._local_cache),
            "capacity": self._local_cache.capacity,
        }


# Singleton-friendly factory
def get_embeddings() -> OpenRouterEmbeddings:
    """Returns an OpenRouterEmbeddings instance."""
    return OpenRouterEmbeddings()
