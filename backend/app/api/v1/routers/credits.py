"""
Credits API Router
Provides a dedicated endpoint to query analysis credit status for the current user.
Returns: total, used, remaining, reset_at (ISO timestamp), retry_after_seconds.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional
import logging

from app.core.database import get_db
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.models.repo import Repo
from app.models.user import User

logger = logging.getLogger("repohawk.credits")

router = APIRouter(prefix="/credits", tags=["Credits"])


@router.get("/analysis")
async def get_analysis_credits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns real-time credit information for repository analysis quota.
    - 5 credits per 4-hour rolling window
    - Failed repos do NOT consume a credit
    - Once analyzed, Q&A chat is 100% free & unlimited
    """
    window_seconds = getattr(settings, "RATE_LIMIT_ANALYSIS_WINDOW_SECONDS", 14400)
    limit = getattr(settings, "RATE_LIMIT_ANALYSIS_PER_WINDOW", 5)
    window_start = datetime.utcnow() - timedelta(seconds=window_seconds)

    # Fetch repos created within the window (excludes failed)
    stmt = (
        select(Repo.created_at)
        .where(
            Repo.user_id == current_user.id,
            Repo.created_at >= window_start,
            Repo.analysis_status != "failed",
        )
        .order_by(Repo.created_at.asc())
    )
    res = await db.execute(stmt)
    recent_created_ats = res.scalars().all()

    used = min(limit, len(recent_created_ats))
    remaining = max(0, limit - used)

    # Compute reset time — when oldest entry in window ages out
    retry_after_seconds: Optional[int] = None
    reset_at: Optional[str] = None

    if remaining == 0 and recent_created_ats:
        oldest = recent_created_ats[0]
        refresh_time = oldest + timedelta(seconds=window_seconds)
        retry_after_seconds = max(1, int((refresh_time - datetime.utcnow()).total_seconds()))
        reset_at = refresh_time.isoformat() + "Z"

    return {
        "total": limit,
        "used": used,
        "remaining": remaining,
        "window_hours": window_seconds // 3600,
        "reset_at": reset_at,
        "retry_after_seconds": retry_after_seconds,
        "chat_is_free": True,  # Q&A chat is always 100% free
    }
