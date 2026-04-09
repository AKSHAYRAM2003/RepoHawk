from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(prefix="/chat", tags=["Conversation Agent"])

class ChatMessageRequest(BaseModel):
    repo_id: str
    session_id: str | None = None
    query: str

@router.post("/")
async def chat_with_codebase(payload: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """
    RAG endpoint to ask questions using LangGraph QA Agent and persisting into the ChatSession.
    """
    return {"reply": f"Received your query regarding {payload.repo_id}: '{payload.query}' (Not implemented fully yet)"}
