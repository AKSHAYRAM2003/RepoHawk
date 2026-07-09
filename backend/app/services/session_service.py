from typing import Optional, Sequence
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.user_session import UserSession


async def get_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> Sequence[UserSession]:
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id, UserSession.is_active == True)
        .order_by(UserSession.last_active_at.desc())
    )
    return result.scalars().all()


async def create_session(db: AsyncSession, user_id: uuid.UUID, token: str, user_agent: Optional[str] = None, ip_address: Optional[str] = None) -> UserSession:
    session = UserSession(
        user_id=user_id,
        token=token,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def revoke_session(db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return False
    session.is_active = False
    await db.commit()
    return True


async def touch_session(db: AsyncSession, token: str) -> None:
    result = await db.execute(
        select(UserSession).where(
            UserSession.token == token,
            UserSession.is_active == True,
        )
    )
    session = result.scalar_one_or_none()
    if session:
        session.last_active_at = datetime.utcnow()
        await db.commit()
