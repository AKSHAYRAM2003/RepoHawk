import json
import uuid as uuidlib
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.agents.graph import qa_graph
from app.agents.nodes.qa_agent import astream_qa_answer
from app.services import chat_service
from app.services.rate_limit import chat_limiter
from app.models.qa_metrics import QAQuery
from app.models.chat import ChatSession
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


def _history_to_messages(history: Optional[List[Dict]]):
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


@router.post("/", response_model=ChatResponse)
async def chat_with_codebase(
    payload: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.post("/stream")
async def chat_stream(
    payload: ChatStreamRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client_host = request.client.host if request.client else "unknown"
    rl_key = f"{client_host}:{payload.session_id or 'new'}"
    allowed, retry_after = chat_limiter.check(rl_key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {retry_after:.1f}s.",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )

    session = await chat_service.get_or_create_session(
        db, payload.session_id, payload.repo_id, current_user.id
    )
    session_id = str(session.id)

    try:
        await chat_service.append_message(db, session_id, role="user", content=payload.query)
    except Exception as e:
        logger.warning(f"Failed to persist user message: {e}")

    history_messages = await chat_service.load_history_for_context(db, session_id)

    async def event_generator():
        collected_answer = ""
        collected_highlight = ""
        collected_code_ref = None
        collected_source_files: List[str] = []
        metrics_payload: Dict = {}

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
                if event.get("type") == "sources":
                    collected_highlight = event.get("highlight_node_id", "") or ""
                    collected_code_ref = event.get("code_ref")
                    collected_source_files = event.get("files", []) or []
                elif event.get("type") == "metrics":
                    metrics_payload = event
                elif event.get("type") == "token":
                    collected_answer += event.get("delta", "")
                yield {"event": "message", "data": json.dumps(event)}
        except Exception as e:
            err = {"type": "error", "message": str(e)}
            yield {"event": "message", "data": json.dumps(err)}
            yield {"event": "message", "data": json.dumps({"type": "done"})}

        if collected_answer.strip():
            try:
                await chat_service.append_message(
                    db, session_id, role="assistant", content=collected_answer,
                    highlight_node_id=collected_highlight or None,
                    code_ref=collected_code_ref,
                    source_files=collected_source_files,
                )
            except Exception as e:
                logger.warning(f"Failed to persist assistant message: {e}")

        if metrics_payload:
            try:
                await _persist_metrics(
                    db, session_id=session_id, repo_id=payload.repo_id,
                    question=payload.query, metrics=metrics_payload,
                    answer_length=len(collected_answer),
                    highlight_node_id=collected_highlight or None,
                    user_id=current_user.id,
                )
            except Exception as e:
                logger.warning(f"Failed to persist qa_query metrics: {e}")

    return EventSourceResponse(event_generator())


async def _persist_metrics(
    db: AsyncSession,
    *,
    session_id: str,
    repo_id: str,
    question: str,
    metrics: Dict,
    answer_length: int,
    highlight_node_id: Optional[str],
    user_id: uuid.UUID,
):
    try:
        sid = uuid.UUID(session_id)
        rid = uuid.UUID(repo_id)
    except (ValueError, TypeError):
        return
    row = QAQuery(
        session_id=sid,
        repo_id=rid,
        user_id=user_id,
        question=question[:500],
        rewritten_question=(metrics.get("rewritten_question") or "")[:500] or None,
        num_chunks_retrieved=int(metrics.get("num_chunks_retrieved") or 0),
        num_chunks_kept=int(metrics.get("num_chunks_kept") or 0),
        relevance_threshold=0,
        answer_length_chars=answer_length,
        highlight_node_id=highlight_node_id,
        highlight_hit=bool(highlight_node_id),
        latency_total_ms=int(metrics.get("latency_total_ms") or 0),
        latency_retrieval_ms=int(metrics.get("latency_retrieval_ms") or 0),
        latency_llm_ms=int(metrics.get("latency_llm_ms") or 0),
        tokens_in=0,
        tokens_out=0,
        error=metrics.get("error"),
    )
    db.add(row)
    await db.commit()


@router.get("/sessions/{repo_id}")
async def list_sessions(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = await chat_service.list_sessions_for_repo(db, repo_id, current_user.id)
    return {"sessions": sessions}


@router.get("/sessions/{repo_id}/{session_id}/messages")
async def get_session_messages(
    repo_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    try:
        sid = uuid.UUID(session_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    stmt = select(ChatSession).where(
        ChatSession.id == sid,
        ChatSession.user_id == current_user.id,
    )
    res = await db.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")
    messages = await chat_service.load_history(db, session_id)
    return {"session_id": session_id, "repo_id": repo_id, "messages": messages}


@router.get("/metrics/{session_id}")
async def get_session_metrics(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    try:
        sid = uuid.UUID(session_id)
    except (ValueError, TypeError):
        return {"metrics": []}
    stmt = (
        select(QAQuery)
        .where(QAQuery.session_id == sid, QAQuery.user_id == current_user.id)
        .order_by(QAQuery.created_at.desc())
        .limit(50)
    )
    res = await db.execute(stmt)
    rows = res.scalars().all()
    return {
        "session_id": session_id,
        "metrics": [
            {
                "id": str(r.id),
                "question": r.question,
                "rewritten_question": r.rewritten_question,
                "num_chunks_retrieved": r.num_chunks_retrieved,
                "num_chunks_kept": r.num_chunks_kept,
                "answer_length_chars": r.answer_length_chars,
                "highlight_node_id": r.highlight_node_id,
                "highlight_hit": r.highlight_hit,
                "latency_total_ms": r.latency_total_ms,
                "latency_retrieval_ms": r.latency_retrieval_ms,
                "latency_llm_ms": r.latency_llm_ms,
                "tokens_in": r.tokens_in,
                "tokens_out": r.tokens_out,
                "error": r.error,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }
