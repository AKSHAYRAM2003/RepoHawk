"""
Distributed Vector Store Adapter
Supports dual backends:
1. ChromaDB (embedded, on-disk) for local development
2. pgvector (PostgreSQL distributed) for horizontal production scale
"""

import os
import uuid
import logging
import threading
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings
from app.core.config import settings

logger = logging.getLogger("repohawk.vector_store")

_chroma_client = None
_chroma_lock = threading.Lock()


def get_chroma_client():
    """Return the shared ChromaDB PersistentClient (created once, reused)."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client
    with _chroma_lock:
        if _chroma_client is not None:
            return _chroma_client
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chroma_db")
        _chroma_client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(allow_reset=True, anonymized_telemetry=False)
        )
        return _chroma_client


class PgVectorCollection:
    """
    Adapter mimicking ChromaDB Collection API backed by PostgreSQL pgvector.
    Enables distributed vector search across any number of web workers.
    """

    def __init__(self, repo_id: str):
        self.repo_id = str(repo_id).replace("repo_", "")

    def add(
        self,
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        ids: List[str],
    ):
        """Insert or bulk upsert code chunk embeddings into PostgreSQL."""
        from app.core.database import SessionLocal
        from app.models.repo_embedding import RepoEmbedding

        db = SessionLocal()
        try:
            repo_uuid = uuid.UUID(self.repo_id)
            records = []
            for doc, emb, meta in zip(documents, embeddings, metadatas):
                records.append(
                    RepoEmbedding(
                        repo_id=repo_uuid,
                        file_path=meta.get("path", meta.get("file_path", "unknown")),
                        chunk_index=meta.get("chunk_index", 0),
                        line_start=meta.get("line_start", 1),
                        line_end=meta.get("line_end", 1),
                        content=doc,
                        embedding=emb,
                        extra_metadata=meta,
                    )
                )
            db.bulk_save_objects(records)
            db.commit()
            logger.info(f"Saved {len(records)} embeddings to pgvector for repo {self.repo_id}")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save embeddings to pgvector: {e}")
            raise
        finally:
            db.close()

    def query(
        self,
        query_embeddings: List[List[float]],
        n_results: int = 8,
        where: Optional[Dict[str, Any]] = None,
        include: Optional[List[str]] = None,
    ) -> Dict[str, List[List[Any]]]:
        """Query nearest vector neighbors using cosine distance operator (<=>)."""
        from app.core.database import SessionLocal
        from app.models.repo_embedding import RepoEmbedding
        from sqlalchemy import select

        if not query_embeddings:
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

        query_vec = query_embeddings[0]
        db = SessionLocal()
        try:
            repo_uuid = uuid.UUID(self.repo_id)
            distance_col = RepoEmbedding.embedding.cosine_distance(query_vec).label("distance")

            stmt = (
                select(RepoEmbedding, distance_col)
                .where(RepoEmbedding.repo_id == repo_uuid)
                .order_by("distance")
                .limit(n_results)
            )

            results = db.execute(stmt).all()

            docs = []
            metas = []
            distances = []

            for row, dist in results:
                docs.append(row.content)
                meta = dict(row.extra_metadata or {})
                meta["path"] = row.file_path
                meta["line_start"] = row.line_start
                meta["line_end"] = row.line_end
                metas.append(meta)
                distances.append(float(dist))

            return {
                "documents": [docs],
                "metadatas": [metas],
                "distances": [distances],
            }
        except Exception as e:
            logger.error(f"Error querying pgvector: {e}")
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}
        finally:
            db.close()

    def count(self) -> int:
        """Count total embeddings stored for this repository."""
        from app.core.database import SessionLocal
        from app.models.repo_embedding import RepoEmbedding
        from sqlalchemy import select, func

        db = SessionLocal()
        try:
            repo_uuid = uuid.UUID(self.repo_id)
            stmt = select(func.count(RepoEmbedding.id)).where(RepoEmbedding.repo_id == repo_uuid)
            return db.execute(stmt).scalar() or 0
        finally:
            db.close()

    def delete(self, where: Optional[Dict[str, Any]] = None):
        """Delete all embeddings for this repository."""
        from app.core.database import SessionLocal
        from app.models.repo_embedding import RepoEmbedding
        from sqlalchemy import delete

        db = SessionLocal()
        try:
            repo_uuid = uuid.UUID(self.repo_id)
            stmt = delete(RepoEmbedding).where(RepoEmbedding.repo_id == repo_uuid)
            db.execute(stmt)
            db.commit()
            logger.info(f"Deleted pgvector embeddings for repo {self.repo_id}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting pgvector embeddings: {e}")
        finally:
            db.close()


def get_collection(repo_id: str):
    """Return the active collection adapter based on VECTOR_STORE_BACKEND setting."""
    backend = settings.VECTOR_STORE_BACKEND.lower()
    if backend == "pgvector":
        return PgVectorCollection(repo_id=str(repo_id))
    else:
        client = get_chroma_client()
        sanitized_name = f"repo_{str(repo_id).replace('-', '_')}"
        return client.get_or_create_collection(name=sanitized_name)


def delete_collection(repo_id: str):
    """Delete the collection from the active vector store."""
    backend = settings.VECTOR_STORE_BACKEND.lower()
    if backend == "pgvector":
        col = PgVectorCollection(repo_id=str(repo_id))
        col.delete()
    else:
        client = get_chroma_client()
        sanitized_name = f"repo_{str(repo_id).replace('-', '_')}"
        try:
            client.delete_collection(name=sanitized_name)
        except Exception:
            pass
