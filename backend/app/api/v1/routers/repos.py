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
import logging

logger = logging.getLogger("repohawk.repos")

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

    # ── Pre-retry cleanup: remove stale artifacts so the pipeline starts clean ──
    # 1. Remove previous git clone (if still present)
    try:
        from app.agents.nodes.git_cloner import cleanup_clone
        cleanup_clone(str(repo_id))
    except Exception:
        pass

    # 2. Drop stale ChromaDB collection (embedder will recreate it)
    try:
        from app.core.vector_store import get_chroma_client
        collection_name = f"repo_{str(repo_id).replace('-', '_')}"
        client = get_chroma_client()
        client.delete_collection(name=collection_name)
    except Exception:
        pass

    # Reset state
    repo.analysis_status = "queued"
    repo.logs = []
    
    # Remove previous diagram
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


async def get_file_content_from_source(repo_id: str, path: str, allow_chroma_fallback: bool = True):
    """
    Get file content by trying the filesystem clone first (true bytes),
    and falling back to ChromaDB reconstruction if the clone is gone.
    Returns (content, source) or (None, None).
    """
    import os
    from app.agents.nodes.git_cloner import get_clone_path
    
    # ── 1. Filesystem (Primary Source of Truth) ──
    try:
        clone_path = get_clone_path(str(repo_id))
        if os.path.isdir(clone_path):
            real_clone = os.path.realpath(clone_path)
            file_path = os.path.realpath(os.path.join(clone_path, path.lstrip("/")))
            if os.path.commonpath([file_path, real_clone]) == real_clone and os.path.isfile(file_path):
                with open(file_path, "r", encoding="utf-8", errors="replace") as fh:
                    return fh.read(), "filesystem"
    except Exception:
        pass
        
    if not allow_chroma_fallback:
        return None, None
        
    # ── 2. ChromaDB Fallback (Potentially Truncated) ──
    try:
        from app.core.vector_store import get_chroma_client
        collection_name = f"repo_{str(repo_id).replace('-', '_')}"
        client = get_chroma_client()
        collection = client.get_collection(name=collection_name)

        results = collection.get(
            where={"path": path},
            include=["documents", "metadatas"],
            limit=500,
        )
        docs = results.get("documents") or []
        metadatas = results.get("metadatas") or []

        if docs:
            paired = list(zip(docs, metadatas))
            paired.sort(key=lambda x: int((x[1] or {}).get("chunk_index", 0)))
            content = "".join(d for d, _ in paired if d)
            return content, "chromadb"
    except Exception:
        pass
        
    return None, None


@router.get("/{repo_id}/file")
async def get_repo_file(
    repo_id: uuid.UUID,
    path: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the raw content of a single file."""
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    content, source = await get_file_content_from_source(str(repo_id), path, allow_chroma_fallback=True)
    if content is None:
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    size_bytes = len(content.encode("utf-8"))
    return {
        "path": path,
        "content": content,
        "size_bytes": size_bytes,
        "lines": content.count("\n") + 1,
        "source": source,
    }


@router.get("/{repo_id}/dependencies")
async def get_repo_dependencies(
    repo_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse and return dependencies from manifest files."""
    import json as _json
    import re

    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    if repo.analysis_status != "complete":
        return {"manifests": [], "status": repo.analysis_status}

    # ── Helper: fetch a manifest file's raw text ───────────────────────────
    MANIFEST_FILES = [
        "package.json",
        "requirements.txt",
        "pyproject.toml",
        "go.mod",
    ]

    async def get_file_text(filename: str) -> str | None:
        # Never fall back to Chroma for manifests - they need to be valid and un-truncated!
        content, _ = await get_file_content_from_source(str(repo_id), filename, allow_chroma_fallback=False)
        return content

    manifests = []

    # ── package.json (Node.js) ─────────────────────────────────────────────
    pkg_text = await get_file_text("package.json")
    if pkg_text:
        try:
            pkg = _json.loads(pkg_text)
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
    # Handles: name, name[extras], nameOP version, "; env-marker", inline
    # comments, editable installs (-e ...), VCS/URL installs (git+…, https://…),
    # and config directives (-r, -c, --index-url, …) which are not dependencies.
    req_text = await get_file_text("requirements.txt")
    if req_text:
        try:
            deps = []
            for raw_line in req_text.splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue

                # Editable installs ("-e .", "-e .[dev]", "-e git+…#egg=…") —
                # must be handled before the inline-comment strip below, since
                # the '#' in "#egg=" is meaningful for these directives.
                if line.startswith("-e "):
                    target = line[3:].strip()
                    cand = (
                        target.split("#egg=")[-1].split("[")[0]
                        .split("=")[0].split("@")[0].strip()
                    )
                    name = (cand or target)[:60]
                    deps.append({"name": name, "version": "", "type": "editable"})
                    continue

                # VCS / URL installs (git+…, hg+…, https://…). May contain
                # "#egg=…"; treated intact here, before the comment strip below.
                if line.startswith(("git+", "hg+", "svn+", "bzr+", "http://", "https://")):
                    cand = line.split("#egg=")[-1].split("[")[0].split("&")[0].strip()
                    name = (cand or line)[:80]
                    deps.append({"name": name, "version": "", "type": "vcs"})
                    continue

                # Config directives (-r/--requirement, -c/--constraint, index
                # URLs, --find-links, …) are not dependencies — skip intentionally.
                if line.startswith((
                    "-r", "--requirement", "-c", "--constraint",
                    "-f", "--find-links", "-i", "--index-url",
                    "--extra-index-url", "--no-index", "--pre",
                    "--trusted-host", "--hash",
                )):
                    continue

                # Plain package spec: strip inline comments before matching.
                if "#" in line:
                    line = line.split("#", 1)[0].strip()
                if not line:
                    continue

                # name[extras] <OP version> ; env-marker   (extras + marker optional)
                m = re.match(
                    r'^([A-Za-z0-9_][A-Za-z0-9_\-\.]*(?:\[[^\]]+\])?)'
                    r'\s*([><=!~^][^;]*)?'
                    r'\s*(;.*)?$',
                    line,
                )
                if m:
                    name = m.group(1).strip()
                    version = (m.group(2) or "").strip()
                    deps.append({"name": name, "version": version, "type": "runtime"})
            if deps:
                manifests.append({"file": "requirements.txt", "ecosystem": "pip", "dependencies": deps})
        except Exception:
            pass

    # ── pyproject.toml (Python) — include even if requirements.txt exists ──
    pyproj_text = await get_file_text("pyproject.toml")
    if pyproj_text:
        try:
            deps = []
            in_deps = False
            for line in pyproj_text.splitlines():
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
    gomod_text = await get_file_text("go.mod")
    if gomod_text:
        try:
            module = ""
            deps = []
            in_require = False
            for line in gomod_text.splitlines():
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
            if module or deps:
                manifests.append({
                    "file": "go.mod",
                    "ecosystem": "go",
                    "name": module,
                    "dependencies": sorted(deps, key=lambda d: (d["type"], d["name"])),
                })
        except Exception:
            pass

    # Distinguish "repo genuinely has no manifests" (clone present, none found)
    # from "we couldn't read them because the on-disk clone is gone" (recoverable
    # by re-running analysis). PR 1 made the filesystem the source of truth and
    # disabled Chroma fallback for manifests, so a missing clone means the files
    # are unreadable rather than truly absent. The frontend's dependencies page
    # has a dedicated "clone_missing" message that prompts the user to re-run
    # analysis; re-emitting that status here keeps that branch reachable.
    if not manifests:
        try:
            import os
            from app.agents.nodes.git_cloner import get_clone_path
            clone_present = os.path.isdir(get_clone_path(str(repo_id)))
        except Exception:
            # If we can't inspect the filesystem, assume the clone is present so
            # we don't mislead with a "clone_missing" status.
            clone_present = True
        status = "clone_missing" if not clone_present else "no_manifests_found"
    else:
        status = "complete"

    return {
        "manifests": manifests,
        "total_manifests": len(manifests),
        "status": status,
    }


@router.get("/{repo_id}/generate-readme")
async def generate_readme(
    repo_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream a generated README.md for the given repository.
    
    Uses the architecture diagram + top code samples from ChromaDB as context,
    then prompts the LLM to produce a comprehensive open-source README.
    """
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    if repo.analysis_status != "complete":
        raise HTTPException(status_code=400, detail="Repository analysis is not complete yet.")

    # ── Collect architecture context ───────────────────────────────────────────
    diag_stmt = select(Diagram).where(
        Diagram.repo_id == repo_id,
        Diagram.user_id == current_user.id,
    )
    diag_result = await db.execute(diag_stmt)
    diagram = diag_result.scalars().first()

    arch_summary = ""
    if diagram and diagram.reactflow_json:
        try:
            nodes = diagram.reactflow_json.get("nodes", [])
            arch_lines = []
            for node in nodes[:30]:  # limit to first 30 nodes
                data = node.get("data", {})
                label = data.get("label", "")
                ntype = data.get("type", "")
                desc = data.get("description", "")
                tech = data.get("tech", "")
                layer = data.get("layer", "")
                if label:
                    line = f"- **{label}** ({ntype}, layer: {layer})"
                    if tech:
                        line += f" — Tech: `{tech}`"
                    if desc:
                        line += f". {desc}"
                    arch_lines.append(line)
            arch_summary = "\n".join(arch_lines)
        except Exception:
            arch_summary = ""

    # ── Collect code samples from ChromaDB ────────────────────────────────────
    code_context = ""
    try:
        from app.core.vector_store import get_chroma_client
        collection_name = f"repo_{str(repo_id).replace('-', '_')}"
        client = get_chroma_client()
        try:
            collection = client.get_collection(name=collection_name)
            # Get a representative sample of code chunks
            sample = collection.get(limit=20, include=["documents", "metadatas"])
            docs = sample.get("documents") or []
            metas = sample.get("metadatas") or []
            code_snippets = []
            seen_paths = set()
            for doc, meta in zip(docs, metas):
                if not doc or not meta:
                    continue
                path = meta.get("path", meta.get("file_path", ""))
                if path in seen_paths:
                    continue
                seen_paths.add(path)
                snippet = doc[:400].replace("\n", "\n  ")
                code_snippets.append(f"### `{path}`\n```\n  {snippet}\n```")
            code_context = "\n\n".join(code_snippets[:10])
        except Exception:
            pass
    except Exception:
        pass

    # ── Build the README generation prompt ───────────────────────────────────
    system_prompt = """You are an expert technical writer and open-source maintainer.
Your task is to generate a comprehensive, well-structured README.md file for a GitHub repository.
The README must be professional, visually appealing in markdown, and follow open-source best practices.

## README Structure Requirements:
1. Project title with badges placeholder (build status, license, version)
2. One-line tagline / description
3. Table of Contents
4. Key Features (bullet list with ✓ or emoji icons)
5. Architecture Overview (a text description of the system based on the diagram info provided)
6. Tech Stack (table format: Layer | Technology)
7. Getting Started (Prerequisites, Installation steps, Environment Variables)
8. Usage / Quick Start with code examples
9. Project Structure (directory tree if you can infer it)
10. Contributing section
11. License section

## Rules:
- Use markdown formatting throughout (headers, tables, code blocks, badges)
- Be specific about technologies you observe in the context
- If you don't have enough information for a section, write a sensible placeholder with [TODO] markers
- Do NOT repeat the same information in multiple sections
- Output ONLY the README markdown content — no preamble or explanation
"""

    user_prompt = f"""Generate a README.md for the repository: **{repo.name}** (by {repo.owner})
GitHub URL: {repo.github_url}

## Architecture Components:
{arch_summary or "(No architecture data available)"}

## Code Samples:
{code_context or "(No code samples available)"}

Generate the full README.md now:"""

    # ── Stream the LLM response ────────────────────────────────────────────────
    async def event_generator():
        try:
            from app.core.llm import get_llm
            from app.core.config import settings
            from langchain_core.messages import SystemMessage, HumanMessage

            llm = get_llm(model=settings.MODEL_CHAT, temperature=0.3, timeout=120.0)
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            # Stream tokens
            async for chunk in llm.astream(messages):
                if await request.is_disconnected():
                    break
                token = getattr(chunk, "content", "") or ""
                if token:
                    yield {
                        "event": "token",
                        "data": json.dumps({"token": token}),
                    }

            yield {
                "event": "done",
                "data": json.dumps({"status": "complete"}),
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }

    return EventSourceResponse(event_generator())


@router.get("/{repo_id}/search")
async def search_repository(
    repo_id: uuid.UUID,
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Perform a semantic search over the repository's code files using ChromaDB embeddings."""
    stmt = select(Repo).where(Repo.id == repo_id, Repo.user_id == current_user.id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    if repo.analysis_status != "complete":
        raise HTTPException(status_code=400, detail="Repository analysis is not complete yet.")

    try:
        from app.core.vector_store import get_chroma_client
        from app.core.embeddings import get_embeddings

        collection_name = f"repo_{str(repo_id).replace('-', '_')}"
        client = get_chroma_client()
        collection = client.get_collection(name=collection_name)

        embeddings_model = get_embeddings()
        query_vector = embeddings_model.embed_query(q)

        results = collection.query(
            query_embeddings=[query_vector],
            n_results=8,
            include=["documents", "metadatas", "distances"]
        )

        formatted = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, distances):
                score = max(0.0, min(1.0, 1.0 - (dist / 2.0))) # Cosine distance -> similarity score
                formatted.append({
                    "file_path": meta.get("path", meta.get("file_path", "unknown")),
                    "content": doc,
                    "line_start": meta.get("line_start", 1),
                    "line_end": meta.get("line_end", 1),
                    "score": round(score, 3)
                })

        # Sort by similarity score descending
        formatted.sort(key=lambda x: x["score"], reverse=True)
        return {"results": formatted}
    except Exception as e:
        logger.error(f"Error performing semantic search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

