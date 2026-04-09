from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/repos", tags=["Repositories"])

class AnalyzeRepoRequest(BaseModel):
    github_url: str

@router.post("/analyze")
async def analyze_repo(payload: AnalyzeRepoRequest, db: AsyncSession = Depends(get_db)):
    """
    Kicks off the LangGraph AST parsing & Diagramming process.
    """
    # Logic will go here to trigger the agent queue
    return {"status": "queued", "message": f"Analyzing {payload.github_url}"}

@router.get("/{repo_id}")
async def get_repo_details(repo_id: str, db: AsyncSession = Depends(get_db)):
    """
    Fetch repository summary and its generated diagrams.
    """
    # Logic will go here
    return {"repo_id": repo_id, "status": "Not Implemented"}
