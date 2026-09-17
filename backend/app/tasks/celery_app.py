"""
Celery Worker & Broker Configuration
Handles decoupled task execution for CPU-heavy repository analysis, AST parsing, and indexing.
"""

from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "repohawk_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.repo_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max for gigantic repo clones
    task_soft_time_limit=3300,
    worker_prefetch_multiplier=1,  # Prevent worker from hoarding multiple heavy analysis tasks
    worker_concurrency=2,
    task_routes={
        "repohawk.analyze_repo": {"queue": "repo_indexing"},
        "repohawk.cleanup_cache": {"queue": "maintenance"},
    },
)

if __name__ == "__main__":
    celery_app.start()
