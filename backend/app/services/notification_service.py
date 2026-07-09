import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.user import User

logger = logging.getLogger("repohawk.notifications")


async def get_notifications(
    db: AsyncSession,
    user_id,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
) -> list[Notification]:
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read == False)
    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_unread_count(db: AsyncSession, user_id) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )
    return result.scalar() or 0


async def mark_as_read(db: AsyncSession, notification_id, user_id) -> Optional[Notification]:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        db.add(notif)
        await db.commit()
        await db.refresh(notif)
    return notif


async def mark_all_as_read(db: AsyncSession, user_id):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )
    for notif in result.scalars().all():
        notif.is_read = True
        db.add(notif)
    await db.commit()


async def create_notification(
    db: AsyncSession,
    user_id,
    notif_type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return notif


async def get_preferences(db: AsyncSession, user_id) -> NotificationPreference:
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = NotificationPreference(user_id=user_id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


async def update_preferences(db: AsyncSession, user_id, data: dict) -> NotificationPreference:
    prefs = await get_preferences(db, user_id)
    for key, value in data.items():
        if value is not None:
            setattr(prefs, key, value)
    db.add(prefs)
    await db.commit()
    await db.refresh(prefs)
    return prefs
