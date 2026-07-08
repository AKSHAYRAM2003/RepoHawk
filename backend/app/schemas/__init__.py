from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: Optional[str] = None
    is_verified: bool
    github_id: Optional[int] = None
    github_username: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    count: int


# ── GitHub ────────────────────────────────────────────────────────────────────

class GitHubRepoResponse(BaseModel):
    id: uuid.UUID
    github_repo_id: int
    owner: str
    name: str
    full_name: str
    private: bool
    default_branch: str
    repo_url: str
    auto_analyze: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GitHubInstallationResponse(BaseModel):
    id: uuid.UUID
    installation_id: int
    account_login: str
    account_type: str
    account_avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None
    repos: list[GitHubRepoResponse] = []

    class Config:
        from_attributes = True


class GitHubConnectionStatus(BaseModel):
    connected: bool
    installation: Optional[GitHubInstallationResponse] = None


class UpdateAutoAnalyzeRequest(BaseModel):
    repo_id: uuid.UUID
    auto_analyze: bool


# ── Webhook ───────────────────────────────────────────────────────────────────

class WebhookEvent(BaseModel):
    action: Optional[str] = None
    installation: Optional[dict] = None
    repositories: Optional[list] = None
    repository: Optional[dict] = None
    sender: Optional[dict] = None
