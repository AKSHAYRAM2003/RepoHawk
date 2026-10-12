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
LOCAL_DIM = 384
EMBED_DIM = 2048  # Default dim for nvidia/nemotron-3-embed-1b:free


class _LRUCache:
    """Thread-safe LRU cache."""

    def __init__(self, capacity: int = 512):
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


_query_cache = _LRUCache(capacity=512)


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


_model_lock = threading.Lock()
_model_instance = None


def _get_local_model():
    global _model_instance
    if _model_instance is not None:
        return _model_instance
    with _model_lock:
        if _model_instance is not None:
            return _model_instance
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading local embedding model: {LOCAL_MODEL}")
        _model_instance = SentenceTransformer(LOCAL_MODEL)
        logger.info(f"Local embedding model loaded (dim={LOCAL_DIM})")
        return _model_instance


class LocalEmbeddings:
    """
    Local embedding via sentence-transformers.
    """

    def __init__(self, *, use_cache: bool = True, cache_capacity: int = 512):
        self.dim = LOCAL_DIM
        self._use_cache = use_cache
        if cache_capacity != 512:
            self._local_cache = _LRUCache(capacity=cache_capacity)
        else:
            self._local_cache = _query_cache

    def _embed(self, texts: List[str]) -> List[List[float]]:
        model = _get_local_model()
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
        return await loop.run_in_executor(None, lambda: self.embed_query(text))

    async def embed_documents_async(self, texts: List[str]) -> List[List[float]]:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.embed_documents(texts))

    def cache_stats(self) -> dict:
        return {
            "size": len(self._local_cache),
            "capacity": self._local_cache.capacity,
        }


class OpenRouterEmbeddings:
    """
    OpenRouter embeddings client supporting models like nvidia/nemotron-3-embed-1b:free.
    Features batching, LRU caching, retries, and fallback to local embeddings.
    """

    def __init__(self, model: Optional[str] = None, *, use_cache: bool = True):
        from app.core.config import settings
        self.model = model or getattr(settings, "MODEL_EMBED", "nvidia/nemotron-3-embed-1b:free")
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
        self.dim = 2048 if "nemotron" in self.model else 384
        self._use_cache = use_cache
        self._cache = _query_cache
        self._local_fallback = None

    def _call_api(self, texts: List[str], max_retries: int = 3) -> List[List[float]]:
        import json
        import random
        import time
        import urllib.request

        url = f"{self.base_url}/embeddings"
        payload = json.dumps({"model": self.model, "input": texts}).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://repohawk.app",
            "X-Title": "RepoHawk",
        }

        last_err = None
        for attempt in range(1, max_retries + 1):
            try:
                req = urllib.request.Request(url, headers=headers, data=payload)
                with urllib.request.urlopen(req, timeout=30) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    vectors = [item["embedding"] for item in data.get("data", [])]
                    if vectors:
                        self.dim = len(vectors[0])
                        return vectors
                    raise ValueError("No embeddings returned from OpenRouter API")
            except Exception as e:
                last_err = e
                err_str = str(e).lower()
                if "429" in err_str or "rate" in err_str or attempt >= max_retries:
                    logger.warning(f"OpenRouter embedding unavailable/rate-limited ({e!s:.100}). Switching to local fallback.")
                    break
                wait = (2 ** attempt) + random.uniform(0.2, 0.8)
                logger.warning(f"OpenRouter embedding attempt {attempt} failed ({e!s:.100}), retrying in {wait:.1f}s...")
                time.sleep(wait)

        raise last_err

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        # Check cache for any already-embedded texts
        results: List[Optional[List[float]]] = [None] * len(texts)
        uncached_indices: List[int] = []
        uncached_texts: List[str] = []

        if self._use_cache:
            for i, text in enumerate(texts):
                key = _cache_key(text)
                cached = self._cache.get(key)
                if cached is not None:
                    results[i] = cached
                else:
                    uncached_indices.append(i)
                    uncached_texts.append(text)
        else:
            uncached_indices = list(range(len(texts)))
            uncached_texts = texts

        if uncached_texts:
            # Batch in chunks of 50 to avoid request payload limits
            BATCH_SIZE = 50
            for start in range(0, len(uncached_texts), BATCH_SIZE):
                batch = uncached_texts[start: start + BATCH_SIZE]
                batch_indices = uncached_indices[start: start + BATCH_SIZE]
                try:
                    vectors = self._call_api(batch)
                    for idx, vec in zip(batch_indices, vectors):
                        results[idx] = vec
                        if self._use_cache:
                            self._cache.set(_cache_key(texts[idx]), vec)
                except Exception as err:
                    logger.warning(f"OpenRouter embedding batch failed: {err}. Falling back to LocalEmbeddings for this batch.")
                    if self._local_fallback is None:
                        self._local_fallback = LocalEmbeddings()
                    local_vectors = self._local_fallback.embed_documents(batch)
                    for idx, vec in zip(batch_indices, local_vectors):
                        results[idx] = vec

        return [r for r in results if r is not None]

    def embed_query(self, text: str) -> List[float]:
        if self._use_cache:
            key = _cache_key(text)
            cached = self._cache.get(key)
            if cached is not None:
                return cached
            vecs = self.embed_documents([text])
            if vecs:
                self._cache.set(key, vecs[0])
                return vecs[0]
        vecs = self.embed_documents([text])
        return vecs[0] if vecs else [0.0] * self.dim

    async def embed_query_async(self, text: str) -> List[float]:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.embed_query(text))

    async def embed_documents_async(self, texts: List[str]) -> List[List[float]]:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.embed_documents(texts))

    def cache_stats(self) -> dict:
        return {
            "size": len(self._cache),
            "capacity": self._cache.capacity,
            "model": self.model,
            "dim": self.dim,
        }


def get_embeddings():
    """
    Returns an embedding client instance based on the configured provider.

    Priority:
      1. LLM_PROVIDER_EMBED=bedrock  → BedrockEmbeddingsClient (Titan 1536-dim)
         NOTE: Switching to Bedrock embed requires a full re-index of all Chroma collections
         because the vector dimension changes (2048 → 1536).
      2. MODEL_EMBED set + OPENROUTER_API_KEY  → OpenRouterEmbeddings (nemotron 2048-dim)
      3. Fallback → LocalEmbeddings (all-MiniLM-L6-v2, 384-dim)
    """
    from app.core.config import settings

    # Route to Bedrock Titan embeddings
    if getattr(settings, "LLM_PROVIDER_EMBED", "openrouter") == "bedrock":
        from app.core.bedrock import BedrockEmbeddingsClient
        return BedrockEmbeddingsClient()

    # OpenRouter remote embeddings
    embed_model = getattr(settings, "MODEL_EMBED", None)
    if embed_model and settings.OPENROUTER_API_KEY and not embed_model.startswith("local"):
        return OpenRouterEmbeddings(model=embed_model)

    # Local sentence-transformers fallback
    return LocalEmbeddings()
