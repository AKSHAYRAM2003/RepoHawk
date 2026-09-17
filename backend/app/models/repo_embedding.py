"""
PostgreSQL pgvector Embedding Model
Stores distributed vector embeddings and chunk metadata directly inside PostgreSQL.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from app.core.database import Base


class RepoEmbedding(Base):
    __tablename__ = "repo_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id = Column(UUID(as_uuid=True), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    chunk_index = Column(Integer, default=0)
    line_start = Column(Integer, default=1)
    line_end = Column(Integer, default=1)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384), nullable=False)
    extra_metadata = Column(JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index(
            "ix_repo_embeddings_hnsw",
            embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
