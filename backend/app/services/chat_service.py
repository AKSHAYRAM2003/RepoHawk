"""
Chat Service
Encapsulates all DB I/O for chat sessions and messages.
Used by the chat router to persist history and load existing context.
"""
import uuid
import logging
from typing import List, Dict, Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatSession, ChatMessage
from app.models.repo import Repo

logger = logging.getLogger("repohawk.chat_service")


async def get_or_create_session(
    db: AsyncSession,
    session_id: Optional[str],
    repo_id: str,
) -> ChatSession:
    """
    Return the existing ChatSession for `session_id`, or create a new one
    linked to `repo_id`. Validates ownership (the session must belong to the
    given repo).
    """
    if session_id:
        try:
            sid = uuid.UUID(session_id)
        except (ValueError, TypeError):
            sid = None
        if sid:
            stmt = select(ChatSession).where(ChatSession.id == sid)
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                # Verify ownership
                if str(existing.repo_id) == str(repo_id):
                    return existing
                logger.warning(
                    f"chat_service: session {sid} belongs to a different repo. "
                    f"Creating a new one."
                )

    # Create a new session
    new_session = ChatSession(repo_id=uuid.UUID(repo_id))
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    logger.info(f"chat_service: created new ChatSession {new_session.id} for repo {repo_id}")
    return new_session


async def load_history(db: AsyncSession, session_id: str) -> List[Dict[str, Any]]:
    """
    Load all messages for a session, ordered by created_at ASC.
    Returns a list of {role, content, highlight_node_id, code_ref, source_files}.
    """
    try:
        sid = uuid.UUID(session_id)
    except (ValueError, TypeError):
        return []

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == sid)
        .order_by(ChatMessage.created_at.asc())
    )
    res = await db.execute(stmt)
    messages = res.scalars().all()

    return [
        {
            "role": m.role,
            "content": m.content,
            "highlight_node_id": m.highlight_node_id,
            "code_ref": m.code_ref,
            "source_files": m.source_files,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


async def load_history_for_context(
    db: AsyncSession, session_id: str
) -> List[Any]:
    """
    Load history and convert to LangChain messages (HumanMessage / AIMessage).
    Used by the QA agent to get prior turns for the LLM.
    """
    rows = await load_history(db, session_id)
    from langchain_core.messages import HumanMessage, AIMessage
    out = []
    for r in rows:
        content = r.get("content", "")
        if not content:
            continue
        if r.get("role") == "user":
            out.append(HumanMessage(content=content))
        elif r.get("role") == "assistant":
            out.append(AIMessage(content=content))
    return out


async def append_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
    highlight_node_id: Optional[str] = None,
    code_ref: Optional[Dict[str, Any]] = None,
    source_files: Optional[List[str]] = None,
) -> ChatMessage:
    """
    Append a single message (user or assistant) to the session.
    """
    sid = uuid.UUID(session_id)
    msg = ChatMessage(
        session_id=sid,
        role=role,
        content=content,
        highlight_node_id=highlight_node_id,
        code_ref=code_ref,
        source_files=source_files or [],
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def list_sessions_for_repo(
    db: AsyncSession, repo_id: str
) -> List[Dict[str, Any]]:
    """
    List all chat sessions for a repo (most recent first).
    """
    try:
        rid = uuid.UUID(repo_id)
    except (ValueError, TypeError):
        return []

    stmt = (
        select(ChatSession)
        .where(ChatSession.repo_id == rid)
        .order_by(ChatSession.created_at.desc())
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return [
        {
            "id": str(s.id),
            "repo_id": str(s.repo_id),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]
