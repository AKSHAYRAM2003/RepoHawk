from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db, async_session_maker
from app.models.repo import Repo
from app.services.analysis import run_repo_analysis
import uuid

router = APIRouter(prefix="/repos", tags=["Repositories"])

class AnalyzeRepoRequest(BaseModel):
    github_url: str

class RepoResponse(BaseModel):
    id: uuid.UUID
    github_url: str
    analysis_status: str

    class Config:
        from_attributes = True

@router.post("/analyze", response_model=RepoResponse)
async def analyze_repo(
    payload: AnalyzeRepoRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Kicks off the LangGraph AST parsing & Diagramming process.
    """
    # 1. Create Repo record
    # Extract name/owner from URL (simple split for now)
    parts = payload.github_url.rstrip("/").split("/")
    repo_name = parts[-1]
    repo_owner = parts[-2] if len(parts) > 1 else "unknown"

    new_repo = Repo(
        github_url=payload.github_url,
        name=repo_name,
        owner=repo_owner,
        analysis_status="queued"
    )
    db.add(new_repo)
    await db.commit()
    await db.refresh(new_repo)

    # 2. Add Background Task
    background_tasks.add_task(run_repo_analysis, new_repo.id, async_session_maker)

    return new_repo

@router.get("/{repo_id}", response_model=RepoResponse)
async def get_repo_details(repo_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Fetch repository summary and its generated diagrams.
    """
    stmt = select(Repo).where(Repo.id == repo_id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
        
    return repo
