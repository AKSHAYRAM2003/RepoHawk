import os
import shutil
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, desc

from app.models.qa_metrics import QAQuery
from app.models.repo import Repo
from app.core.config import settings

CLONE_BASE_DIR = os.path.join(os.environ.get("TMPDIR", "/tmp"), "repohawk")
CHROMA_PERSIST_DIR = os.path.join(os.getcwd(), "chroma_db")


def _get_dir_size_bytes(path: str) -> int:
    """Calculate total size of directory in bytes."""
    if not os.path.exists(path):
        return 0
    total_size = 0
    try:
        for dirpath, _, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total_size += os.path.getsize(fp)
    except Exception:
        pass
    return total_size


def _get_dir_items_count(path: str) -> int:
    """Count subdirectories/clones in the directory."""
    if not os.path.exists(path):
        return 0
    try:
        return len([d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))])
    except Exception:
        return 0


class ObservabilityService:

    @staticmethod
    async def get_overview(db: AsyncSession, days: Optional[int] = 30) -> Dict[str, Any]:
        """Aggregate high-level KPIs across AI and backend operations."""
        query_filter = []
        repo_filter = []
        if days is not None and days > 0:
            cutoff = datetime.utcnow() - timedelta(days=days)
            query_filter.append(QAQuery.created_at >= cutoff)
            repo_filter.append(Repo.created_at >= cutoff)

        # ── AI Query Aggregations ──
        qa_stmt = select(
            func.count(QAQuery.id).label("total_queries"),
            func.coalesce(func.sum(QAQuery.tokens_in), 0).label("tokens_in"),
            func.coalesce(func.sum(QAQuery.tokens_out), 0).label("tokens_out"),
            func.coalesce(func.avg(QAQuery.latency_total_ms), 0).label("avg_latency_ms"),
            func.coalesce(func.avg(QAQuery.latency_retrieval_ms), 0).label("avg_retrieval_ms"),
            func.coalesce(func.avg(QAQuery.latency_llm_ms), 0).label("avg_llm_ms"),
            func.coalesce(func.sum(QAQuery.num_chunks_retrieved), 0).label("chunks_retrieved"),
            func.coalesce(func.sum(QAQuery.num_chunks_kept), 0).label("chunks_kept"),
            func.coalesce(func.count(case((QAQuery.error.isnot(None), 1))), 0).label("error_count"),
            func.coalesce(func.count(case((QAQuery.highlight_hit == True, 1))), 0).label("highlight_hits"),
        ).where(*query_filter)

        qa_res = await db.execute(qa_stmt)
        qa_stats = qa_res.one()

        total_queries = int(qa_stats.total_queries or 0)
        tokens_in = int(qa_stats.tokens_in or 0)
        tokens_out = int(qa_stats.tokens_out or 0)
        total_tokens = tokens_in + tokens_out

        # Estimated cost model (Blended ~$0.0003 per 1K tokens)
        estimated_cost_usd = round((tokens_in * 0.00015 + tokens_out * 0.0006) / 1000, 4)

        # ── Pipeline / Repo Aggregations ──
        repo_stmt = select(
            func.count(Repo.id).label("total_repos"),
            func.coalesce(func.count(case((Repo.analysis_status == "completed", 1))), 0).label("completed_repos"),
            func.coalesce(func.count(case((Repo.analysis_status == "failed", 1))), 0).label("failed_repos"),
            func.coalesce(func.count(case((Repo.analysis_status.in_(["queued", "cloning", "parsing", "diagramming", "indexing"]), 1))), 0).label("active_repos"),
        ).where(*repo_filter)

        repo_res = await db.execute(repo_stmt)
        repo_stats = repo_res.one()

        total_repos = int(repo_stats.total_repos or 0)
        completed_repos = int(repo_stats.completed_repos or 0)
        failed_repos = int(repo_stats.failed_repos or 0)
        active_repos = int(repo_stats.active_repos or 0)
        pipeline_success_rate = round((completed_repos / total_repos * 100) if total_repos > 0 else 100.0, 1)

        # ── Disk & Storage Metrics ──
        clone_storage_bytes = _get_dir_size_bytes(CLONE_BASE_DIR)
        clone_count = _get_dir_items_count(CLONE_BASE_DIR)

        sys_disk = shutil.disk_usage("/")
        disk_free_gb = round(sys_disk.free / (1024 ** 3), 2)
        disk_total_gb = round(sys_disk.total / (1024 ** 3), 2)
        disk_used_percent = round((sys_disk.used / sys_disk.total) * 100, 1)

        chunks_retrieved = int(qa_stats.chunks_retrieved or 0)
        chunks_kept = int(qa_stats.chunks_kept or 0)
        highlight_hits = int(qa_stats.highlight_hits or 0)

        return {
            "ai": {
                "total_queries": total_queries,
                "total_tokens": total_tokens,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "estimated_cost_usd": estimated_cost_usd,
                "avg_latency_ms": round(float(qa_stats.avg_latency_ms or 0)),
                "avg_retrieval_ms": round(float(qa_stats.avg_retrieval_ms or 0)),
                "avg_llm_ms": round(float(qa_stats.avg_llm_ms or 0)),
                "chunks_retrieved": chunks_retrieved,
                "chunks_kept": chunks_kept,
                "retrieval_efficiency_percent": round(
                    (chunks_kept / chunks_retrieved * 100)
                    if chunks_retrieved > 0 else 100.0, 1
                ),
                "highlight_accuracy_percent": round(
                    (highlight_hits / total_queries * 100)
                    if total_queries > 0 else 100.0, 1
                ),
                "error_count": int(qa_stats.error_count or 0),
            },
            "pipeline": {
                "total_repos": total_repos,
                "completed_repos": completed_repos,
                "failed_repos": failed_repos,
                "active_repos": active_repos,
                "success_rate_percent": pipeline_success_rate,
            },
            "storage": {
                "clone_cache_mb": round(clone_storage_bytes / (1024 * 1024), 2),
                "clone_count": clone_count,
                "disk_free_gb": disk_free_gb,
                "disk_total_gb": disk_total_gb,
                "disk_used_percent": disk_used_percent,
            },
            "models": {
                "chat_model": settings.MODEL_CHAT,
                "diagram_model": settings.MODEL_DIAGRAM,
                "fallback_model": settings.MODEL_FALLBACK,
            }
        }

    @staticmethod
    async def get_ai_telemetry(db: AsyncSession, limit: int = 50) -> Dict[str, Any]:
        """Detailed AI metrics including latency breakdowns and recent queries."""
        stmt = (
            select(QAQuery)
            .order_by(desc(QAQuery.created_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        recent_queries = res.scalars().all()

        query_list = []
        for q in recent_queries:
            query_list.append({
                "id": str(q.id),
                "repo_id": str(q.repo_id),
                "question": q.question,
                "rewritten_question": q.rewritten_question,
                "latency_total_ms": q.latency_total_ms or 0,
                "latency_retrieval_ms": q.latency_retrieval_ms or 0,
                "latency_llm_ms": q.latency_llm_ms or 0,
                "tokens_in": q.tokens_in or 0,
                "tokens_out": q.tokens_out or 0,
                "total_tokens": (q.tokens_in or 0) + (q.tokens_out or 0),
                "num_chunks_retrieved": q.num_chunks_retrieved or 0,
                "num_chunks_kept": q.num_chunks_kept or 0,
                "highlight_hit": bool(q.highlight_hit),
                "error": q.error,
                "created_at": q.created_at.isoformat() if q.created_at else None,
            })

        latencies = [q["latency_total_ms"] for q in query_list if q["latency_total_ms"] > 0]
        latencies.sort()
        p50 = latencies[len(latencies) // 2] if latencies else 0
        p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
        p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0

        return {
            "percentiles": {
                "p50_ms": p50,
                "p95_ms": p95,
                "p99_ms": p99,
            },
            "recent_queries": query_list,
        }

    @staticmethod
    async def get_system_health(db: AsyncSession) -> Dict[str, Any]:
        """Health check and resource utilization for host server and database."""
        db_healthy = True
        try:
            await db.execute(select(1))
        except Exception:
            db_healthy = False

        clone_storage_bytes = _get_dir_size_bytes(CLONE_BASE_DIR)
        clone_count = _get_dir_items_count(CLONE_BASE_DIR)
        chroma_storage_bytes = _get_dir_size_bytes(CHROMA_PERSIST_DIR)

        sys_disk = shutil.disk_usage("/")

        return {
            "status": "healthy" if db_healthy else "degraded",
            "database": {
                "connected": db_healthy,
                "dialect": "postgresql",
            },
            "storage": {
                "clone_cache_bytes": clone_storage_bytes,
                "clone_cache_mb": round(clone_storage_bytes / (1024 * 1024), 2),
                "clone_count": clone_count,
                "chroma_storage_mb": round(chroma_storage_bytes / (1024 * 1024), 2),
                "disk_free_gb": round(sys_disk.free / (1024 ** 3), 2),
                "disk_total_gb": round(sys_disk.total / (1024 ** 3), 2),
                "disk_used_percent": round((sys_disk.used / sys_disk.total) * 100, 1),
            },
            "server_time": datetime.utcnow().isoformat(),
        }

    @staticmethod
    def run_garbage_collection(max_age_hours: int = 24) -> Dict[str, Any]:
        """Trigger cleanup of stale clone directories."""
        if not os.path.exists(CLONE_BASE_DIR):
            return {"deleted_count": 0, "freed_mb": 0.0, "message": "No clone directory to clean."}

        now = time.time()
        max_age_seconds = max_age_hours * 3600
        deleted_count = 0
        reclaimed_bytes = 0

        for item in os.listdir(CLONE_BASE_DIR):
            item_path = os.path.join(CLONE_BASE_DIR, item)
            if not os.path.isdir(item_path):
                continue

            try:
                mtime = os.path.getmtime(item_path)
                age = now - mtime
                if age > max_age_seconds or max_age_hours == 0:
                    size = _get_dir_size_bytes(item_path)
                    shutil.rmtree(item_path)
                    deleted_count += 1
                    reclaimed_bytes += size
            except Exception:
                pass

        return {
            "deleted_count": deleted_count,
            "freed_mb": round(reclaimed_bytes / (1024 * 1024), 2),
            "message": f"Successfully cleaned {deleted_count} clone(s), freed {round(reclaimed_bytes / (1024 * 1024), 2)} MB.",
        }
