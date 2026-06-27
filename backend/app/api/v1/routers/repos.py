from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db, async_session_maker
from app.models.repo import Repo
from app.models.diagram import Diagram
from app.models.user import User
from app.services.analysis import run_repo_analysis
from app.core.progress import progress_manager, task_manager
from app.core.dependencies import get_current_user
from sse_starlette.sse import EventSourceResponse
from datetime import datetime
import uuid
from typing import List, Optional
import asyncio
import json

router = APIRouter(prefix="/repos", tags=["Repositories"])

class AnalyzeRepoRequest(BaseModel):
    github_url: str

class RepoResponse(BaseModel):
    id: uuid.UUID
    github_url: str
    owner: Optional[str] = None
    name: Optional[str] = None
    analysis_status: str
    created_at: Optional[datetime] = None
    logs: Optional[list] = None

    class Config:
        from_attributes = True

class DiagramResponse(BaseModel):
    id: uuid.UUID
    repo_id: uuid.UUID
    mermaid_syntax: Optional[str] = None
    reactflow_json: Optional[dict] = None
    confidence_level: Optional[str] = None

    class Config:
        from_attributes = True

@router.post("/analyze", response_model=RepoResponse)
async def analyze_repo(
    payload: AnalyzeRepoRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    parts = payload.github_url.rstrip("/").split("/")
    repo_name = parts[-1]
    repo_owner = parts[-2] if len(parts) > 1 else "unknown"

    new_repo = Repo(
        github_url=payload.github_url,
        name=repo_name,
        owner=repo_owner,
        analysis_status="queued",
        user_id=current_user.id,
    )
    db.add(new_repo)
    await db.commit()
    await db.refresh(new_repo)

    background_tasks.add_task(run_repo_analysis, new_repo.id, async_session_maker)
    return new_repo

@router.get("/", response_model=List[RepoResponse])
async def list_repositories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Repo).where(Repo.user_id == current_user.id).order_by(Repo.created_at.desc())
    result = await db.execute(stmt)
    repos = result.scalars().all()
    return repos

@router.get("/{repo_id}", response_model=RepoResponse)
async def get_repo_details(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    return repo

@router.get("/{repo_id}/diagrams", response_model=List[DiagramResponse])
async def get_repo_diagrams(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Diagram).where(
        Diagram.repo_id == repo_id,
        Diagram.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    diagrams = result.scalars().all()
    return diagrams

@router.get("/{repo_id}/stream")
async def stream_repo_progress(
    repo_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    async def event_generator():
        rid = str(repo_id)
        queue = progress_manager.get_queue(rid)
        try:
            yield {
                "event": "message",
                "data": json.dumps({
                    "step": "connected",
                    "log": "📡 Connected to analysis event stream...",
                    "status": repo.analysis_status
                })
            }
            if repo.analysis_status in ("complete", "failed"):
                persisted_logs = repo.logs or []
                for log_entry in persisted_logs:
                    yield {"event": "message", "data": json.dumps(log_entry)}
                try:
                    while True:
                        data = queue.get_nowait()
                        yield {"event": "message", "data": json.dumps(data)}
                except asyncio.QueueEmpty:
                    pass
                yield {
                    "event": "message",
                    "data": json.dumps({
                        "step": "pipeline_complete" if repo.analysis_status == "complete" else "pipeline_error",
                        "log": f"{'🎉' if repo.analysis_status == 'complete' else '❌'} Analysis {repo.analysis_status}.",
                        "status": repo.analysis_status
                    })
                }
                return
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield {"event": "message", "data": json.dumps(data)}
                    if data.get("status") in ["complete", "failed"]:
                        break
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            progress_manager.remove_queue(rid, queue)

    return EventSourceResponse(event_generator())

@router.post("/{repo_id}/stop")
async def stop_repo_analysis(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    cancelled = task_manager.cancel_task(str(repo_id))
    if cancelled or repo.analysis_status in ["queued", "running"]:
        repo.analysis_status = "failed"
        await db.commit()
        progress_manager.publish(str(repo_id), {
            "step": "pipeline_cancelled",
            "log": "⏹️ Analysis stopped by user.",
            "status": "failed"
        })
        return {"status": "success", "message": "Analysis stopped."}
    return {"status": "ignored", "message": "No active analysis task to stop."}

@router.post("/{repo_id}/retry", response_model=RepoResponse)
async def retry_repo_analysis(
    repo_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
        
    if repo.analysis_status in ["queued", "running"]:
        raise HTTPException(status_code=400, detail="Analysis is already running")

    # Reset state
    repo.analysis_status = "queued"
    repo.logs = []
    
    # Optional cleanup of previous artifacts
    from sqlalchemy import delete
    await db.execute(delete(Diagram).where(Diagram.repo_id == repo_id))
    
    await db.commit()
    await db.refresh(repo)

    background_tasks.add_task(run_repo_analysis, repo.id, async_session_maker)
    return repo

@router.delete("/{repo_id}")
async def delete_repository(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    task_manager.cancel_task(str(repo_id))
    try:
        from app.agents.nodes.git_cloner import cleanup_clone
        cleanup_clone(str(repo_id))
    except Exception:
        pass

    from sqlalchemy import delete
    from app.models.chat import ChatSession, ChatMessage
    from app.models.qa_metrics import QAQuery

    await db.execute(delete(Diagram).where(Diagram.repo_id == repo_id))
    try:
        await db.execute(delete(QAQuery).where(QAQuery.repo_id == repo_id))
    except Exception:
        pass
    try:
        session_ids_stmt = select(ChatSession.id).where(ChatSession.repo_id == repo_id)
        await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(session_ids_stmt)))
    except Exception:
        pass
    try:
        await db.execute(delete(ChatSession).where(ChatSession.repo_id == repo_id))
    except Exception:
        pass
    try:
        from app.core.vector_store import get_chroma_client
        collection_name = f"repo_{str(repo_id).replace('-', '_')}"
        client = get_chroma_client()
        client.delete_collection(name=collection_name)
    except Exception:
        pass

    await db.delete(repo)
    await db.commit()
    return {"status": "success", "message": "Repository completely removed."}


@router.get("/{repo_id}/files")
async def get_repo_files(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the list of source files that were indexed for this repo."""
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    if repo.analysis_status != "complete":
        return {"files": [], "total": 0, "status": repo.analysis_status}

    try:
        from app.core.vector_store import get_chroma_client
        collection_name = f"repo_{str(repo_id).replace('-', '_')}"
        client = get_chroma_client()

        try:
            collection = client.get_collection(name=collection_name)
        except Exception:
            return {"files": [], "total": 0, "status": "no_index"}

        # Get all documents with metadata (limit high to capture all)
        results = collection.get(include=["metadatas"], limit=10000)
        metadatas = results.get("metadatas") or []

        # Aggregate by file path
        file_map: dict = {}
        for meta in metadatas:
            if not meta:
                continue
            # Embedder stores metadata with key "path" (see embedder.py)
            path = meta.get("path") or meta.get("file_path") or ""
            lang = meta.get("language") or "unknown"
            # Skip chunks that failed to embed — they're not real content
            if meta.get("embed_failed"):
                continue
            if not path:
                continue
            if path not in file_map:
                file_map[path] = {"path": path, "language": lang, "chunk_count": 0}
            file_map[path]["chunk_count"] += 1

        files = sorted(file_map.values(), key=lambda x: x["path"])
        return {"files": files, "total": len(files), "status": "complete"}

    except Exception as e:
        return {"files": [], "total": 0, "error": str(e), "status": "error"}


@router.get("/{repo_id}/dependencies")
async def get_repo_dependencies(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse and return dependencies from manifest files in the cloned repo."""
    import json as _json
    import os
    import re

    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    if repo.analysis_status != "complete":
        return {"manifests": [], "status": repo.analysis_status}

    from app.agents.nodes.git_cloner import get_clone_path
    clone_path = get_clone_path(str(repo_id))

    if not os.path.isdir(clone_path):
        return {"manifests": [], "status": "clone_missing"}

    manifests = []

    # ── package.json (Node.js) ─────────────────────────────────────────────
    pkg_path = os.path.join(clone_path, "package.json")
    if os.path.isfile(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8", errors="replace") as f:
                pkg = _json.load(f)
            deps = []
            for name, version in (pkg.get("dependencies") or {}).items():
                deps.append({"name": name, "version": version, "type": "runtime"})
            for name, version in (pkg.get("devDependencies") or {}).items():
                deps.append({"name": name, "version": version, "type": "dev"})
            for name, version in (pkg.get("peerDependencies") or {}).items():
                deps.append({"name": name, "version": version, "type": "peer"})
            manifests.append({
                "file": "package.json",
                "ecosystem": "npm",
                "name": pkg.get("name", ""),
                "version": pkg.get("version", ""),
                "dependencies": sorted(deps, key=lambda d: (d["type"], d["name"])),
            })
        except Exception:
            pass

    # ── requirements.txt (Python) ──────────────────────────────────────────
    req_path = os.path.join(clone_path, "requirements.txt")
    if os.path.isfile(req_path):
        try:
            with open(req_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            deps = []
            for line in lines:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # parse name==version or name>=version etc.
                m = re.match(r'^([A-Za-z0-9_\-\.]+)\s*([><=!~^]+.+)?$', line)
                if m:
                    deps.append({"name": m.group(1), "version": (m.group(2) or "").strip(), "type": "runtime"})
            manifests.append({"file": "requirements.txt", "ecosystem": "pip", "dependencies": deps})
        except Exception:
            pass

    # ── pyproject.toml (Python) ────────────────────────────────────────────
    pyproj_path = os.path.join(clone_path, "pyproject.toml")
    if os.path.isfile(pyproj_path) and not any(m["file"] == "requirements.txt" for m in manifests):
        try:
            content = open(pyproj_path, "r", encoding="utf-8", errors="replace").read()
            # Very simple extraction — look for [tool.poetry.dependencies] or [project] dependencies
            deps = []
            in_deps = False
            for line in content.splitlines():
                if re.match(r'\[.*dependencies.*\]', line, re.I):
                    in_deps = True
                    continue
                if line.startswith("[") and in_deps:
                    in_deps = False
                if in_deps:
                    m = re.match(r'^([a-zA-Z0-9_\-]+)\s*=\s*"(.+)"', line)
                    if m and m.group(1) != "python":
                        deps.append({"name": m.group(1), "version": m.group(2), "type": "runtime"})
            if deps:
                manifests.append({"file": "pyproject.toml", "ecosystem": "pip", "dependencies": deps})
        except Exception:
            pass

    # ── go.mod (Go) ────────────────────────────────────────────────────────
    gomod_path = os.path.join(clone_path, "go.mod")
    if os.path.isfile(gomod_path):
        try:
            content = open(gomod_path, "r", encoding="utf-8", errors="replace").read()
            module = ""
            deps = []
            in_require = False
            for line in content.splitlines():
                line = line.strip()
                if line.startswith("module "):
                    module = line.split(" ", 1)[1].strip()
                elif line == "require (":
                    in_require = True
                elif line == ")" and in_require:
                    in_require = False
                elif in_require or line.startswith("require "):
                    parts = line.replace("require ", "").split()
                    if len(parts) >= 2:
                        indirect = "// indirect" in line
                        deps.append({
                            "name": parts[0],
                            "version": parts[1],
                            "type": "indirect" if indirect else "runtime"
                        })
            manifests.append({
                "file": "go.mod",
                "ecosystem": "go",
                "name": module,
                "dependencies": sorted(deps, key=lambda d: (d["type"], d["name"])),
            })
        except Exception:
            pass

    return {
        "manifests": manifests,
        "total_manifests": len(manifests),
        "status": "complete" if manifests else "no_manifests_found",
    }
