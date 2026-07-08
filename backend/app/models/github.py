import uuid
from sqlalchemy import Column, String, Boolean, BigInteger, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship


class GitHubInstallation(Base):
    __tablename__ = "github_installations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    installation_id = Column(BigInteger, unique=True, nullable=False, index=True)
    account_login = Column(String, nullable=False)
    account_type = Column(String, default="User")
    account_avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="github_installations")
    repos = relationship("GitHubRepo", back_populates="installation", cascade="all, delete-orphan")


class GitHubRepo(Base):
    __tablename__ = "github_repos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    installation_id = Column(UUID(as_uuid=True), ForeignKey("github_installations.id", ondelete="CASCADE"), nullable=False)
    github_repo_id = Column(BigInteger, nullable=False, index=True)
    owner = Column(String, nullable=False)
    name = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    private = Column(Boolean, default=False)
    default_branch = Column(String, default="main")
    repo_url = Column(String, nullable=False)
    auto_analyze = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    installation = relationship("GitHubInstallation", back_populates="repos")
