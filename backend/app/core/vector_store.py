import chromadb
from chromadb.config import Settings
from app.core.config import settings

import os
import threading

# Module-level singleton — ChromaDB's PersistentClient is intended to be a
# single shared instance per process (official docs: "have only one client").
# Constructing a fresh PersistentClient on every call wastes resources and
# risks concurrent clients contending on the same on-disk path (backend/chroma_db)
# now that several endpoints (/file, /dependencies, /files, /search, /retry,
# /delete) hit it per request. Double-checked locking keeps creation thread-safe
# and makes the hot path lock-free.
_chroma_client = None
_chroma_lock = threading.Lock()


def get_chroma_client():
    """Return the shared ChromaDB PersistentClient (created once, reused)."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client
    with _chroma_lock:
        if _chroma_client is not None:  # second check after acquiring lock
            return _chroma_client
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chroma_db")
        _chroma_client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(allow_reset=True, anonymized_telemetry=False)
        )
        return _chroma_client


# Utility wrapper
def get_collection(repo_id: str):
    client = get_chroma_client()
    return client.get_or_create_collection(name=f"repo_{repo_id}")
