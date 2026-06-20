import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship

class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id = Column(UUID(as_uuid=True), ForeignKey("repos.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String)
    diagram_type = Column(String) # architecture | module | function | flow
    mermaid_syntax = Column(String)
    reactflow_json = Column(JSONB)
    confidence_level = Column(String) # high | medium | low
    confidence_file_count = Column(Integer)
    contributing_files = Column(JSONB)
    
    stale = Column(Boolean, default=False)
    stale_reason = Column(String)
    stale_files = Column(JSONB)
    last_commit_sha = Column(String)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repo = relationship("Repo", back_populates="diagrams")
    user = relationship("User", back_populates="diagrams")
