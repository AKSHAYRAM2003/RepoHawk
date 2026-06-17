"""
RepoHawk Embeddings Client
Uses sentence-transformers for local, instant embedding (no API latency).
"""

import hashlib
import logging
import threading
from collections import OrderedDict
from typing import List, Optional

import numpy as np

logger = logging.getLogger("repohawk.embeddings")

LOCAL_MODEL = "all-MiniLM-L6-v2"
EMBED_DIM = 384


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


_query_cache = _LRUCache(capacity=256)


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


_model_lock = threading.Lock()
_model_instance = None


def _get_model():
    global _model_instance
    if _model_instance is not None:
        return _model_instance
    with _model_lock:
        if _model_instance is not None:
            return _model_instance
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading local embedding model: {LOCAL_MODEL}")
        _model_instance = SentenceTransformer(LOCAL_MODEL)
        logger.info(f"Local embedding model loaded (dim={EMBED_DIM})")
        return _model_instance


class LocalEmbeddings:
    """
    Local embedding via sentence-transformers. Sub-millisecond per query after model load.
    """

    def __init__(self, *, use_cache: bool = True, cache_capacity: int = 256):
        self._use_cache = use_cache
        if cache_capacity != 256:
            self._local_cache = _LRUCache(capacity=cache_capacity)
        else:
            self._local_cache = _query_cache

    def _embed(self, texts: List[str]) -> List[List[float]]:
        model = _get_model()
        emb = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        if isinstance(emb, np.ndarray):
            emb = emb.tolist()
        return emb

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._embed(texts)

    def embed_query(self, text: str) -> List[float]:
        if self._use_cache:
            key = _cache_key(text)
            cached = self._local_cache.get(key)
            if cached is not None:
                return cached
            vec = self._embed([text])[0]
            self._local_cache.set(key, vec)
            return vec
        return self._embed([text])[0]

    async def embed_query_async(self, text: str) -> List[float]:
        import asyncio
        loop = asyncio.get_event_loop()
        if self._use_cache:
            key = _cache_key(text)
            cached = self._local_cache.get(key)
            if cached is not None:
                return cached
            vec = await loop.run_in_executor(None, lambda: self._embed([text])[0])
            self._local_cache.set(key, vec)
            return vec
        return await loop.run_in_executor(None, lambda: self._embed([text])[0])

    async def embed_documents_async(self, texts: List[str]) -> List[List[float]]:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self._embed(texts))

    def cache_stats(self) -> dict:
        return {
            "size": len(self._local_cache),
            "capacity": self._local_cache.capacity,
        }


def get_embeddings() -> LocalEmbeddings:
    return LocalEmbeddings()
