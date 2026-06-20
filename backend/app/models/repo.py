import uuid
from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship

class Repo(Base):
    __tablename__ = "repos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    github_url = Column(String, nullable=False)
    owner = Column(String)
    name = Column(String)
    star_count = Column(Integer)
    analysis_status = Column(String, default="queued")
    last_analyzed_at = Column(DateTime)
    file_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    logs = Column(JSON, default=list)

    user = relationship("User", back_populates="repos")
    diagrams = relationship("Diagram", back_populates="repo")
    chat_sessions = relationship("ChatSession", back_populates="repo")
