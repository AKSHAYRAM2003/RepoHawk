import json
import uuid as uuidlib
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict
from app.core.database import get_db
from app.agents.graph import qa_graph
from app.agents.nodes.qa_agent import astream_qa_answer
from app.services import chat_service
from sse_starlette.sse import EventSourceResponse
import uuid

logger = logging.getLogger("repohawk.chat")

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


class ChatStreamRequest(BaseModel):
    repo_id: str
    session_id: Optional[str] = None
    query: str
    valid_node_ids: Optional[List[str]] = None
    # chat_history is intentionally NOT used in the streaming endpoint —
    # the server loads it from the DB based on session_id, so the client
    # never needs to send it.


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


# ── Non-streaming endpoint (kept for backwards compat) ────────────────────────
@router.post("/", response_model=ChatResponse)
async def chat_with_codebase(payload: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """
    Non-streaming chat. The streaming endpoint `/chat/stream` is preferred.
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
@router.post("/stream")
async def chat_stream(
    payload: ChatStreamRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Streaming chat with persistent history. Yields SSE events:
      { type: "session", session_id }
      { type: "token",   delta }       (per LLM token)
      { type: "sources", files, highlight_node_id, code_ref }
      { type: "done" }
      { type: "error",   message }
    """
    # 1. Get or create the session (validates ownership)
    session = await chat_service.get_or_create_session(
        db, payload.session_id, payload.repo_id
    )
    session_id = str(session.id)

    # 2. Persist the user's question immediately (so even if streaming fails,
    #    the question is in the DB)
    try:
        await chat_service.append_message(
            db, session_id, role="user", content=payload.query
        )
    except Exception as e:
        logger.warning(f"Failed to persist user message: {e}")

    # 3. Load existing history (now includes the user question we just saved)
    history_messages = await chat_service.load_history_for_context(db, session_id)

    # 4. Run the streaming QA agent
    async def event_generator():
        collected_answer = ""
        collected_highlight = ""
        collected_code_ref = None
        collected_source_files: List[str] = []

        try:
            async for event in astream_qa_answer(
                question=payload.query,
                repo_id=payload.repo_id,
                session_id=session_id,
                chat_history=history_messages,
                valid_node_ids=payload.valid_node_ids or [],
            ):
                if await request.is_disconnected():
                    break

                # Capture final fields for persistence after the stream ends
                if event.get("type") == "sources":
                    collected_highlight = event.get("highlight_node_id", "") or ""
                    collected_code_ref = event.get("code_ref")
                    collected_source_files = event.get("files", []) or []
                elif event.get("type") == "token" and not collected_answer:
                    # first token — no special action; we accumulate below
                    pass

                yield {"event": "message", "data": json.dumps(event)}

                if event.get("type") == "token":
                    collected_answer += event.get("delta", "")

        except Exception as e:
            err = {"type": "error", "message": str(e)}
            yield {"event": "message", "data": json.dumps(err)}
            yield {"event": "message", "data": json.dumps({"type": "done"})}

        # 5. Persist the assistant's full answer (only if we got a non-empty one)
        if collected_answer.strip():
            try:
                await chat_service.append_message(
                    db,
                    session_id,
                    role="assistant",
                    content=collected_answer,
                    highlight_node_id=collected_highlight or None,
                    code_ref=collected_code_ref,
                    source_files=collected_source_files,
                )
            except Exception as e:
                logger.warning(f"Failed to persist assistant message: {e}")

    return EventSourceResponse(event_generator())


# ── History endpoints (commit 3) ──────────────────────────────────────────────
@router.get("/sessions/{repo_id}")
async def list_sessions(repo_id: str, db: AsyncSession = Depends(get_db)):
    """List all chat sessions for a repo (most recent first)."""
    sessions = await chat_service.list_sessions_for_repo(db, repo_id)
    return {"sessions": sessions}


@router.get("/sessions/{repo_id}/{session_id}/messages")
async def get_session_messages(
    repo_id: str, session_id: str, db: AsyncSession = Depends(get_db)
):
    """Get all messages for a session."""
    messages = await chat_service.load_history(db, session_id)
    return {"session_id": session_id, "repo_id": repo_id, "messages": messages}
