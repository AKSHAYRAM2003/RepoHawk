from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict
from app.core.database import get_db
from app.agents.graph import qa_graph
import uuid

router = APIRouter(prefix="/chat", tags=["Conversation Agent"])

class ChatMessageRequest(BaseModel):
    repo_id: str
    session_id: Optional[str] = None
    query: str

class ChatResponse(BaseModel):
    answer: str
    session_id: str
    highlight_node_id: Optional[str] = None
    code_ref: Optional[Dict] = None
    source_files: Optional[List[str]] = None

@router.post("/", response_model=ChatResponse)
async def chat_with_codebase(payload: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """
    RAG endpoint to ask questions using LangGraph QA Agent.
    """
    # 1. Prepare Initial State
    # In a real app, we would load existing history from DB/Checkpointer using session_id
    initial_state = {
        "question": payload.query,
        "repo_id": payload.repo_id,
        "session_id": payload.session_id or str(uuid.uuid4()),
        "chat_history": [] 
    }

    try:
        # 2. Invoke QA Graph
        # Synchronous invoke for MVP; easy to make streaming later
        final_state = qa_graph.invoke(initial_state)

        if "error" in final_state and final_state["error"]:
            raise HTTPException(status_code=500, detail=final_state["error"])

        return ChatResponse(
            answer=final_state.get("answer", "I couldn't find an answer."),
            session_id=initial_state["session_id"],
            highlight_node_id=final_state.get("highlight_node_id"),
            code_ref=final_state.get("code_ref"),
            source_files=final_state.get("source_files")
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
