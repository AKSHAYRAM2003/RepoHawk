from typing import Optional
import uuid
import logging
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.core.security import decode_token
from app.models.user import User

logger = logging.getLogger("repohawk.auth")

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # 1. Try Clerk Authentication first if CLERK_SECRET_KEY is configured
    if settings.CLERK_SECRET_KEY:
        try:
            from clerk_backend_api import Clerk
            from clerk_backend_api.security.types import AuthenticateRequestOptions, AuthStatus

            clerk = Clerk(bearer_auth=settings.CLERK_SECRET_KEY)
            options = AuthenticateRequestOptions(secret_key=settings.CLERK_SECRET_KEY)
            state = clerk.authenticate_request(request, options)
            
            if state.status == AuthStatus.SIGNED_IN:
                clerk_user_id = state.payload.get("sub") if state.payload else None
                if not clerk_user_id and hasattr(state, "to_auth"):
                    try:
                        auth_obj = state.to_auth()
                        clerk_user_id = getattr(auth_obj, "user_id", None)
                    except Exception:
                        pass

                if clerk_user_id:
                    user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, clerk_user_id)
                    result = await db.execute(select(User).where(User.id == user_uuid))
                    user = result.scalar_one_or_none()
                    
                    if user:
                        return user

                    # Fetch user info from Clerk to auto-provision in PostgreSQL
                    email = (state.payload.get("email") if state.payload else None) or f"{clerk_user_id}@clerk.repohawk.app"
                    name = None
                    try:
                        u = clerk.users.get(user_id=clerk_user_id)
                        if u:
                            if u.email_addresses and len(u.email_addresses) > 0:
                                email = u.email_addresses[0].email_address
                            name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
                    except Exception as e:
                        logger.warning(f"Could not fetch Clerk user profile: {e}")

                    # Check if user already exists with this email
                    existing_email_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
                    if existing_email_user:
                        return existing_email_user

                    user = User(
                        id=user_uuid,
                        email=email,
                        name=name,
                        password_hash="clerk_managed_auth",
                        is_verified=True,
                    )
                    db.add(user)
                    await db.commit()
                    await db.refresh(user)
                    return user
        except Exception as e:
            logger.debug(f"Clerk authentication check failed: {e}")

    # 2. Fallback to legacy JWT token authentication
    token = request.cookies.get("repohawk_access_token")
    if not token:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]
            
    if token:
        try:
            payload = decode_token(token)
            uid = payload.get("sub")
            if uid:
                result = await db.execute(select(User).where(User.id == uuid.UUID(uid)))
                user = result.scalar_one_or_none()
                if user:
                    return user
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Not authenticated")


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None
