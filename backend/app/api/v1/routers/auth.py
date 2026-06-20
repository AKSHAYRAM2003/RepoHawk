import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.dependencies import get_current_user
from app.schemas import (
    RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest,
    UpdateProfileRequest, ChangePasswordRequest, UserResponse, TokenResponse, MessageResponse,
)
from app.services import auth_service, email_service
from app.models.user import User

logger = logging.getLogger("repohawk.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

COOKIE_ACCESS = "repohawk_access_token"
COOKIE_REFRESH = "repohawk_refresh_token"


def _set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(
        key=COOKIE_ACCESS, value=access, httponly=True, samesite="lax",
        max_age=15 * 60, path="/", secure=False,
    )
    response.set_cookie(
        key=COOKIE_REFRESH, value=refresh, httponly=True, samesite="lax",
        max_age=7 * 24 * 60 * 60, path="/api/auth", secure=False,
    )


def _clear_auth_cookies(response: Response):
    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/api/auth")


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        user = await auth_service.create_user(db, payload.email, payload.password, payload.name)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    await email_service.send_welcome_email(user.email, user.name or "")
    _set_auth_cookies(response, access, refresh)
    return TokenResponse(access_token=access, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await auth_service.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    _set_auth_cookies(response, access, refresh)
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
    updated = await auth_service.update_user(db, user.id, name=payload.name)
    return UserResponse.model_validate(updated)


@router.put("/me/password", response_model=MessageResponse)
async def change_my_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await auth_service.change_password(db, user.id, payload.old_password, payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
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
