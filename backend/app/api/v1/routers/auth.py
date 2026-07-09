import uuid
import logging
import httpx
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.dependencies import get_current_user
from app.schemas import (
    RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest,
    UpdateProfileRequest, ChangePasswordRequest, UserResponse, TokenResponse, MessageResponse,
    SessionResponse,
)
from app.services import auth_service, email_service, session_service
from app.models.user import User

logger = logging.getLogger("repohawk.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

COOKIE_ACCESS = "repohawk_access_token"
COOKIE_REFRESH = "repohawk_refresh_token"

# Auto-detect secure flag: True for https, False for localhost dev
_IS_HTTPS = settings.FRONTEND_URL.startswith("https://")


def _set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(
        key=COOKIE_ACCESS, value=access, httponly=True, samesite="lax",
        max_age=15 * 60, path="/", secure=_IS_HTTPS,
    )
    response.set_cookie(
        key=COOKIE_REFRESH, value=refresh, httponly=True, samesite="lax",
        max_age=7 * 24 * 60 * 60, path="/api/auth", secure=_IS_HTTPS,
    )


def _clear_auth_cookies(response: Response):
    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/api/auth")


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.create_user(db, payload.email, payload.password, payload.name)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    await email_service.send_welcome_email(user.email, user.name or "")
    _set_auth_cookies(response, access, refresh)
    await session_service.create_session(
        db, user.id, access,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    _set_auth_cookies(response, access, refresh)
    await session_service.create_session(
        db, user.id, access,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.post("/logout")
async def logout(response: Response, _: User = Depends(get_current_user)):
    _clear_auth_cookies(response)
    return MessageResponse(message="Logged out")


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(COOKIE_REFRESH)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")
    access = create_access_token(uid)
    _set_auth_cookies(response, access, token)
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == uuid.UUID(uid)))
    user = result.scalar_one_or_none()
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await auth_service.update_user(db, user.id, name=payload.name, avatar_url=payload.avatar_url)
    return UserResponse.model_validate(updated)


@router.put("/me/password", response_model=MessageResponse)
async def change_my_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await auth_service.change_password(db, user.id, payload.new_password, old_password=payload.old_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Could not update password")
    return MessageResponse(message="Password updated")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user:
        token = await auth_service.create_password_reset_token(db, user.id)
        reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
        await email_service.send_password_reset_email(user.email, reset_url)
    return MessageResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    ok = await auth_service.reset_password(db, payload.token, payload.password)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return MessageResponse(message="Password reset successfully")


# ── GitHub OAuth linking ─────────────────────────────────────────────────────

class GitHubOAuthUrlResponse(BaseModel):
    url: str


@router.get("/github/url")
async def github_oauth_url(
    user: User = Depends(get_current_user),
    return_url: Optional[str] = "/settings",
):
    """Generate a GitHub OAuth URL for linking the user's GitHub account."""
    if not settings.GITHUB_APP_CLIENT_ID:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured")

    state = jwt.encode(
        {"sub": str(user.id), "return_url": return_url, "exp": int(time.time()) + 600},
        settings.JWT_SECRET_KEY,
        algorithm="HS256",
    )
    redirect_uri = f"{settings.API_URL}/api/v1/auth/github/callback" if hasattr(settings, 'API_URL') else None
    params = {
        "client_id": settings.GITHUB_APP_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "user:email",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items() if v)
    url = f"https://github.com/login/oauth/authorize?{query}"
    return GitHubOAuthUrlResponse(url=url)


@router.get("/github/callback")
async def github_oauth_callback(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    code: Optional[str] = None,
    state: Optional[str] = None,
):
    """Handle GitHub OAuth callback — exchange code, store user info, redirect to settings."""
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    # Verify state token and identify the user
    try:
        state_data = jwt.decode(state or "", settings.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = state_data.get("sub")
        return_url = state_data.get("return_url", "/settings")
    except Exception as e:
        logger.warning(f"Invalid OAuth state: {e}")
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid state payload")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_APP_CLIENT_ID,
                "client_secret": settings.GITHUB_APP_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="GitHub OAuth token exchange failed")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="No access_token in GitHub response")

        # Fetch the user's GitHub profile
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch GitHub profile")

        github_user = user_resp.json()

    # Update the user record
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.github_id = github_user.get("id")
    user.github_username = github_user.get("login")
    user.github_access_token = access_token
    await db.commit()

    # Redirect to frontend (preserve the page the user was on)
    from urllib.parse import urlencode
    params = urlencode({"github_linked": "1"})
    sep = "&" if "?" in return_url else "?"
    redirect_url = f"{settings.FRONTEND_URL}{return_url}{sep}{params}"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=redirect_url, status_code=303)


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = await session_service.get_user_sessions(db, current_user.id)
    return sessions


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await session_service.revoke_session(db, session_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return MessageResponse(message="Session revoked")


@router.post("/github/unlink")
async def github_unlink(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unlink the user's GitHub account."""
    current_user.github_id = None
    current_user.github_username = None
    current_user.github_access_token = None
    await db.commit()
    return MessageResponse(message="GitHub account unlinked")
