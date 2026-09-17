import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.observability_service import ObservabilityService

logger = logging.getLogger("repohawk.observability")

router = APIRouter(prefix="/observability", tags=["Observability & Telemetry"])


class GcRunRequest(BaseModel):
    max_age_hours: int = 24


@router.get("/overview")
async def get_overview(
    days: Optional[int] = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve high-level KPI metrics across AI and backend operations."""
    return await ObservabilityService.get_overview(db=db, days=days)


@router.get("/ai")
async def get_ai_telemetry(
    limit: Optional[int] = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve detailed AI telemetry, latency percentiles, and recent query events."""
    return await ObservabilityService.get_ai_telemetry(db=db, limit=limit)


@router.get("/system")
async def get_system_health(
    db: AsyncSession = Depends(get_db),
):
    """Retrieve server resource health, disk consumption, and database status."""
    return await ObservabilityService.get_system_health(db=db)


@router.post("/gc/run")
async def run_garbage_collection(
    payload: GcRunRequest = GcRunRequest(),
):
    """Manually trigger garbage collection to purge stale repository clones."""
    return ObservabilityService.run_garbage_collection(max_age_hours=payload.max_age_hours)
