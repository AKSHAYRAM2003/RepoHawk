"""
QA Query Metrics (commit 5)
Records telemetry for every chat query — latency, chunks, tokens, etc.
"""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
from app.core.database import Base


class QAQuery(Base):
    __tablename__ = "qa_queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    repo_id = Column(UUID(as_uuid=True), ForeignKey("repos.id"), nullable=False)

    # Question
    question = Column(String, nullable=False)
    rewritten_question = Column(String, nullable=True)

    # Retrieval
    num_chunks_retrieved = Column(Integer, default=0)
    num_chunks_kept = Column(Integer, default=0)
    relevance_threshold = Column(Integer, default=0)  # store as int (multiplied by 1000)

    # Generation
    answer_length_chars = Column(Integer, default=0)
    highlight_node_id = Column(String, nullable=True)
    highlight_hit = Column(Boolean, default=False)   # True if a valid highlight was chosen

    # Latency (milliseconds)
    latency_total_ms = Column(Integer, default=0)
    latency_retrieval_ms = Column(Integer, default=0)
    latency_llm_ms = Column(Integer, default=0)

    # Tokens
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)

    # Error tracking
    error = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
