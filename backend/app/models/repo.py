import uuid
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship

class Repo(Base):
    __tablename__ = "repos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    github_url = Column(String, nullable=False)
    owner = Column(String)
    name = Column(String)
    star_count = Column(Integer)
    analysis_status = Column(String, default="queued") # queued | running | complete | failed
    last_analyzed_at = Column(DateTime)
    file_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    diagrams = relationship("Diagram", back_populates="repo")
    chat_sessions = relationship("ChatSession", back_populates="repo")
