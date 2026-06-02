import json
import uuid as uuidlib
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict
from app.core.database import get_db
from app.agents.graph import qa_graph
from app.agents.nodes.qa_agent import astream_qa_answer
from sse_starlette.sse import EventSourceResponse
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


# Backwards-compatible non-streaming endpoint. The frontend will migrate to
# the streaming endpoint `/chat/stream` (commit 7), but this stays for any
# other clients.
@router.post("/", response_model=ChatResponse)
async def chat_with_codebase(payload: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """
    RAG endpoint to ask questions using LangGraph QA Agent (non-streaming).
    """
    initial_state = {
        "question": payload.query,
        "repo_id": payload.repo_id,
        "session_id": payload.session_id or str(uuidlib.uuid4()),
        "chat_history": [],
        "valid_node_ids": [],
    }

    try:
        final_state = qa_graph.invoke(initial_state)

        if "error" in final_state and final_state["error"]:
            raise HTTPException(status_code=500, detail=final_state["error"])

        return ChatResponse(
            answer=final_state.get("answer", "I couldn't find an answer."),
            session_id=initial_state["session_id"],
            highlight_node_id=final_state.get("highlight_node_id"),
            code_ref=final_state.get("code_ref"),
            source_files=final_state.get("source_files"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Streaming endpoint (commit 2) ─────────────────────────────────────────────
# Uses server-sent events. The client opens an EventSource (or a fetch with a
# ReadableStream body) and receives incremental events:
#   { type: "session",   session_id }
#   { type: "token",     delta }   — repeated for each token from the LLM
#   { type: "sources",   files, highlight_node_id, code_ref }
#   { type: "done" }
#   { type: "error",     message }
class ChatStreamRequest(BaseModel):
    repo_id: str
    session_id: Optional[str] = None
    query: str
    valid_node_ids: Optional[List[str]] = None
    chat_history: Optional[List[Dict]] = None   # list of {role, content} dicts


def _history_to_messages(history: Optional[List[Dict]]):
    """Convert {role, content} dicts to LangChain messages."""
    from langchain_core.messages import HumanMessage, AIMessage
    if not history:
        return []
    out = []
    for item in history:
        role = item.get("role")
        content = item.get("content", "")
        if not content:
            continue
        if role == "user":
            out.append(HumanMessage(content=content))
        elif role == "assistant":
            out.append(AIMessage(content=content))
    return out


@router.post("/stream")
async def chat_stream(payload: ChatStreamRequest, request: Request):
    """
    Streaming chat endpoint. Returns Server-Sent Events.
    Cancels cleanly if the client disconnects.
    """
    session_id = payload.session_id or str(uuidlib.uuid4())
    history_messages = _history_to_messages(payload.chat_history)

    async def event_generator():
        try:
            async for event in astream_qa_answer(
                question=payload.query,
                repo_id=payload.repo_id,
                session_id=session_id,
                chat_history=history_messages,
                valid_node_ids=payload.valid_node_ids or [],
            ):
                # If the client disconnected, stop generating
                if await request.is_disconnected():
                    break
                yield {"event": "message", "data": json.dumps(event)}
        except Exception as e:
            err = {"type": "error", "message": str(e)}
            yield {"event": "message", "data": json.dumps(err)}
            yield {"event": "message", "data": json.dumps({"type": "done"})}

    return EventSourceResponse(event_generator())
