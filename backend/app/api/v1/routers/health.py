"""
Health Probes & Readiness Checks (Kubernetes & Production Ready)
Provides /healthz (liveness) and /readyz (readiness) for load balancers and orchestrators.
"""

import shutil
import logging
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.redis import check_redis_health

logger = logging.getLogger("repohawk.health")

router = APIRouter(tags=["Health & Probes"])


@router.get("/healthz", summary="Liveness Probe")
async def liveness_probe():
    """Returns 200 OK if the web server process is alive and accepting connections."""
    return {"status": "alive", "service": "repohawk-api"}


@router.get("/readyz", summary="Readiness Probe")
async def readiness_probe(response: Response, db: AsyncSession = Depends(get_db)):
    """
    Returns 200 OK if dependencies (PostgreSQL, Redis, Storage) are healthy.
    Returns 503 Service Unavailable if any critical component is failing.
    """
    checks = {
        "database": False,
        "redis": False,
        "storage": False,
    }

    # 1. Check PostgreSQL
    try:
        await db.execute(select(1))
        checks["database"] = True
    except Exception as db_err:
        logger.error(f"Readiness check: PostgreSQL connection failed: {db_err}")

    # 2. Check Redis
    try:
        checks["redis"] = await check_redis_health()
    except Exception as redis_err:
        logger.warning(f"Readiness check: Redis ping failed: {redis_err}")

    # 3. Check Disk Space (> 1 GB free)
    try:
        disk = shutil.disk_usage("/")
        free_gb = disk.free / (1024 ** 3)
        checks["storage"] = free_gb > 1.0
    except Exception as disk_err:
        logger.error(f"Readiness check: Disk query failed: {disk_err}")

    # Determine overall status: Database & Storage are critical
    all_critical_healthy = checks["database"] and checks["storage"]
    overall_status = "ready" if all_critical_healthy else "degraded"

    if not all_critical_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": overall_status,
        "checks": checks,
    }
