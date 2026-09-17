"""
Repository Background Worker Tasks
Decoupled task execution for LangGraph pipeline, tree-sitter parsing, and vector embeddings.
"""

import uuid
import asyncio
import logging
from celery import shared_task
from app.tasks.celery_app import celery_app
from app.core.database import async_session_maker
from app.services.analysis import run_repo_analysis

logger = logging.getLogger("repohawk.tasks")


@celery_app.task(
    name="repohawk.analyze_repo",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def analyze_repo_task(self, repo_id_str: str):
    """
    Celery task that invokes the async LangGraph repository analysis pipeline.
    Runs inside a dedicated worker process with independent memory and CPU limits.
    """
    logger.info(f"[Celery Worker] Starting repository analysis task for repo ID: {repo_id_str}")
    repo_uuid = uuid.UUID(repo_id_str)

    try:
        # Run async LangGraph pipeline within worker event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_repo_analysis(repo_uuid, async_session_maker))
        finally:
            loop.close()

        logger.info(f"[Celery Worker] Analysis task completed successfully for repo ID: {repo_id_str}")
        return {"status": "completed", "repo_id": repo_id_str}

    except Exception as exc:
        logger.error(f"[Celery Worker] Analysis task failed for repo {repo_id_str}: {exc}", exc_info=True)
        # Retry only if transient error, otherwise raise
        if self.request.retries < self.max_retries:
            logger.warning(f"Retrying analysis for repo {repo_id_str} (attempt {self.request.retries + 1})...")
            raise self.retry(exc=exc)
        raise exc
