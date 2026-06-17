"""
Step 9: QA Agent Node
Handles user questions by retrieving relevant code chunks via RAG and generating
grounded, honest answers using the LLM.

Improvements in this iteration:
  - Structured Pydantic output (QAResponse) — no more `---METADATA---` prose parsing
  - Query rewriting using a cheap LLM call (uses last 2 turns of context for follow-ups)
  - Real node-ID list injected into system prompt — LLM can only pick from valid IDs
  - Source files returned = actual retrieved chunk paths, not LLM claims
  - Highlight node ID validated against real diagram node IDs server-side

Input:  QAState with question, repo_id, session_id, chat_history, valid_node_ids
Output: QAState with answer, retrieved_chunks, highlight_node_id,
        code_ref, source_files
"""

import json
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator

from pydantic import BaseModel, Field

from app.agents.state import QAState, CodeRef
from app.core.llm import get_chat_llm, get_rewrite_llm, invoke_with_fallback
from app.core.embeddings import get_embeddings
from app.core.vector_store import get_chroma_client
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

logger = logging.getLogger("repohawk.qa_agent")

# ── Configuration ─────────────────────────────────────────────────────────────
TOP_K = 8                        # Retrieve more candidates for the filter to work with
RELEVANCE_THRESHOLD = 0.88       # cosine distance; lower = more similar. 0.88 is lenient enough
                                  # for real code-question pairs which typically score 0.75–1.15.
RELEVANCE_FLOOR_CHUNKS = 2       # If filter drops ALL chunks, keep the N closest as best-effort
MAX_HISTORY_TOKENS = 1500        # Rough cap for the chat history we send to the LLM
QUERY_REWRITE_MAX_HISTORY = 2    # Last N turns to use for query rewriting


# ── Structured Output Schema ──────────────────────────────────────────────────
class QAResponse(BaseModel):
    """Structured answer from the chat LLM. The LLM is asked to return this shape,
    and we parse it. The `highlight_node_id` is constrained by what we tell the LLM
    in the system prompt (the real node-ID list from the diagram)."""
    answer: str = Field(..., description="The grounded, honest answer to the user's question.")
    highlight_node_id: str = Field(
        default="",
        description="The diagram node-id that best matches the answer. Must be empty if unsure.",
    )
    code_ref: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Reference to a specific code location, e.g. {file, line_start, line_end}.",
    )


# ── System Prompt ─────────────────────────────────────────────────────────────
def _build_system_prompt(valid_node_ids: List[str]) -> str:
    """
    Build the QA system prompt. `valid_node_ids` is the actual list of node IDs
    from the diagram — the LLM can only choose from this set.
    """
    node_list = ", ".join(f"`{nid}`" for nid in valid_node_ids) if valid_node_ids else "(none)"
    return f"""You are RepoHawk, an expert AI assistant specialized in codebase exploration and architecture analysis.

Your job is to answer questions about a specific codebase using ONLY the code snippets provided in the context below.

## Honesty Rules (CRITICAL — never break these):
1. If the answer is clearly supported by the context, answer confidently with specific file references.
2. If the answer is partially supported, answer what you know and explicitly state what is unclear.
3. If the answer is NOT in the provided code context, say exactly: "I don't have enough context from the indexed codebase to answer this accurately. The relevant code may not have been indexed, or this may be outside the scope of the analyzed files."
4. NEVER guess, hallucinate file names, or invent code that wasn't shown to you.
5. When referencing code, always cite the source file path.

## Answer Style:
- Be concise and precise — no filler text
- Use code blocks (``` ```) for code snippets
- For architectural questions, describe component responsibilities clearly
- Mention the file path when citing evidence

## Highlight Node Selection:
The codebase has a pre-built architecture diagram with these node IDs:
[{node_list}]

If your answer clearly relates to one of these nodes, set `highlight_node_id` to that exact node-id.
If the answer does not relate to any node, or you are unsure, set `highlight_node_id` to "" (empty string).
NEVER invent a node ID. NEVER use a node ID that is not in the list above.

## Code Reference:
If your answer points to a specific function or class, set `code_ref` to {{"file": "<path>", "line_start": <int>, "line_end": <int>}}.
Otherwise, leave it as null.
"""


# ── Query Rewriting ───────────────────────────────────────────────────────────
REWRITE_SYSTEM_PROMPT = """You are a query-rewriting assistant for a code RAG system.
Given the current user question and recent chat history, rewrite the question into a
self-contained, search-optimized query that can be embedded against a codebase index.

Rules:
- Output ONLY the rewritten query. No preamble, no explanation.
- If the question is already self-contained, return it unchanged.
- If it references prior context (e.g. "and how is that called from the frontend?"),
  resolve the reference using the chat history.
- Keep code identifiers, file paths, and technical terms intact.
- Do NOT add new information that wasn't in the original question or history.
"""


async def rewrite_query(question: str, chat_history: List) -> str:
    """
    Rewrites the user's question into a self-contained, search-optimized query.
    CRITICAL: This is a non-blocking, best-effort optimization. It MUST NOT
    block the main LLM path. A hard 5-second asyncio timeout ensures it fails
    fast on rate limits, network stalls, or model unavailability.

    Skip entirely if there's no prior history — no disambiguation needed.
    Falls back to the original question on any error.
    """
    if not chat_history:
        return question

    import asyncio

    async def _do_rewrite() -> str:
        from langchain_core.messages import SystemMessage, HumanMessage

        history_text = []
        for msg in chat_history[-(QUERY_REWRITE_MAX_HISTORY * 2):]:
            role = "user" if isinstance(msg, HumanMessage) else "assistant" if isinstance(msg, AIMessage) else "other"
            content = getattr(msg, "content", "") or ""
            if content:
                history_text.append(f"{role}: {content[:300]}")
        history_block = "\n".join(history_text) if history_text else "(no prior conversation)"

        messages = [
            SystemMessage(content=REWRITE_SYSTEM_PROMPT),
            HumanMessage(content=f"CHAT HISTORY:\n{history_block}\n\nCURRENT QUESTION:\n{question}"),
        ]
        llm = get_rewrite_llm()
        result = llm.invoke(messages)
        rewritten = (getattr(result, "content", "") or "").strip()
        if rewritten and len(rewritten) <= len(question) * 4 + 200:
            if rewritten != question:
                logger.info(f"QA Agent: Rewrote query '{question[:60]}' -> '{rewritten[:60]}'")
            return rewritten
        return question

    try:
        return await asyncio.wait_for(_do_rewrite(), timeout=5.0)
    except asyncio.TimeoutError:
        logger.debug("QA Agent: Query rewriting timed out (5s), using original question")
        return question
    except Exception as e:
        logger.debug(f"QA Agent: Query rewriting failed ({type(e).__name__}), using original question")
        return question


# ── Helpers ───────────────────────────────────────────────────────────────────
def _coerce_valid_node_ids(raw) -> List[str]:
    """Accept whatever the caller passed for valid_node_ids and normalize to a list of strings."""
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
        except Exception:
            return []
    if isinstance(raw, list):
        return [str(x) for x in raw]
    return []


def _validate_node_id(candidate: str, valid_ids: List[str]) -> str:
    """
    Strict exact-match validator. Returns the candidate only if it exactly
    matches a known node id. Otherwise returns empty string.
    """
    if not candidate or not valid_ids:
        return ""
    valid_set = set(valid_ids)
    if candidate in valid_set:
        return candidate
    return ""


# ── Main Agent Node ───────────────────────────────────────────────────────────
def qa_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: RAG-powered Q&A over the indexed codebase.

    Steps:
      1. (optional) Rewrite the question using chat history
      2. Embed the rewritten question using the same model used during indexing
      3. Query ChromaDB with the vector; apply relevance threshold
      4. Build a grounded LLM prompt with retrieved context
      5. Call LLM with structured output (QAResponse)
      6. Validate highlight_node_id against the real diagram node IDs
      7. Return the validated answer + actual retrieved source files
    """
    question = state.get("question", "").strip()
    repo_id = state.get("repo_id", "")
    chat_history = state.get("chat_history", [])
    valid_node_ids = _coerce_valid_node_ids(state.get("valid_node_ids", []))

    if not question:
        return {
            "answer": "Please ask a question about the codebase.",
            "source_files": [],
            "retrieved_chunks": [],
        }

    if not repo_id:
        return {
            "error": "Missing repo_id",
            "answer": "I'm sorry, I don't have a repository context to search.",
            "source_files": [],
        }

    try:
        # ── 1. Query rewriting (sync wrapper around async helper) ─────────────
        rewritten_question = question
        try:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # LangGraph may invoke nodes synchronously inside an async loop;
                    # fall back to original question for safety.
                    rewritten_question = question
                else:
                    rewritten_question = loop.run_until_complete(
                        rewrite_query(question, chat_history)
                    )
            except RuntimeError:
                rewritten_question = question
        except Exception:
            rewritten_question = question

        # ── 2. Embed the (rewritten) question ─────────────────────────────────
        embeddings_client = get_embeddings()
        try:
            query_vector = embeddings_client.embed_query(rewritten_question)
        except Exception as embed_err:
            logger.error(f"QA Agent: Failed to embed question — {embed_err}")
            return {
                "error": str(embed_err),
                "answer": (
                    "I encountered an issue connecting to the embedding service. "
                    "Please try again in a moment."
                ),
                "source_files": [],
            }

        # ── 3. Retrieve from ChromaDB ─────────────────────────────────────────
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        client = get_chroma_client()

        try:
            collection = client.get_collection(name=collection_name)
        except Exception:
            logger.warning(
                f"QA Agent: Collection '{collection_name}' not found. "
                f"The repository may not have been indexed yet."
            )
            return {
                "answer": (
                    "This repository hasn't been indexed for semantic search yet. "
                    "Please re-run the analysis to enable Q&A on the codebase."
                ),
                "source_files": [],
                "retrieved_chunks": [],
            }

        results = collection.query(
            query_embeddings=[query_vector],
            n_results=min(TOP_K, collection.count()),
        )

        raw_chunks: List[str] = results.get("documents", [[]])[0]
        raw_metadatas: List[Dict] = results.get("metadatas", [[]])[0]
        raw_distances: List[float] = (results.get("distances") or [[]])[0]

        if not raw_chunks:
            return {
                "answer": (
                    "I searched the codebase index but couldn't find any relevant code "
                    "for your question. Try rephrasing or asking about a specific file or component."
                ),
                "source_files": [],
                "retrieved_chunks": [],
            }

        # Apply relevance threshold (drop chunks whose cosine distance is too high).
        # Also filter out chunks marked embed_failed (defensive — added in commit 6).
        filtered_chunks: List[str] = []
        filtered_metadatas: List[Dict] = []
        ranked_pairs = []  # track (dist, chunk, meta) for fallback
        for chunk, meta, dist in zip(raw_chunks, raw_metadatas, raw_distances or [0.0] * len(raw_chunks)):
            if meta.get("embed_failed"):
                continue
            d = dist if dist is not None else 1.0
            ranked_pairs.append((d, chunk, meta))
            if not (raw_distances and d > RELEVANCE_THRESHOLD):
                filtered_chunks.append(chunk)
                filtered_metadatas.append(meta)

        if not filtered_chunks:
            # Adaptive fallback: threshold filtered everything out — use the N closest
            # chunks as best-effort context so the LLM can still attempt an answer.
            ranked_pairs.sort(key=lambda x: x[0])
            best = ranked_pairs[:RELEVANCE_FLOOR_CHUNKS]
            if best:
                logger.warning(
                    f"QA Agent: All chunks exceeded threshold; using top-{len(best)} closest "
                    f"(distances: {[round(d,3) for d,_,_ in best]}) as best-effort context."
                )
                filtered_chunks = [c for _, c, _ in best]
                filtered_metadatas = [m for _, _, m in best]
            else:
                return {
                    "answer": (
                        "I searched the codebase but couldn't find any relevant code for your question. "
                        "Try rephrasing or asking about a specific file or function."
                    ),
                    "source_files": [],
                    "retrieved_chunks": [],
                }

        chunks = filtered_chunks
        metadatas = filtered_metadatas

        # ── 4. Build context string ───────────────────────────────────────────
        context_parts = []
        for chunk, meta in zip(chunks, metadatas):
            file_path = meta.get("path", "unknown")
            language = meta.get("language", "")
            context_parts.append(
                f"### File: `{file_path}`\n```{language}\n{chunk.strip()}\n```"
            )
        context_str = "\n\n".join(context_parts)

        # Source files: actual retrieved chunk file paths (not LLM claims).
        # Cap at 8 to keep the UI clean.
        source_files = list(dict.fromkeys(
            m.get("path", "") for m in metadatas if m.get("path")
        ))[:8]

        # ── 5. Build LLM messages ─────────────────────────────────────────────
        messages = [
            SystemMessage(content=_build_system_prompt(valid_node_ids)),
            SystemMessage(content=f"## Retrieved Code Context:\n\n{context_str}"),
        ]

        # Add recent chat history (best-effort token cap; rough heuristic)
        if chat_history:
            history_slice = chat_history[-12:]   # last 6 turns; we trim further if too long
            approx_tokens = 0
            kept = []
            for msg in reversed(history_slice):
                content = getattr(msg, "content", "") or ""
                approx_tokens += len(content) // 4
                if approx_tokens > MAX_HISTORY_TOKENS:
                    break
                kept.append(msg)
            kept.reverse()
            messages.extend(kept)

        messages.append(HumanMessage(content=question))

        # ── 6. Invoke LLM (structured output) ─────────────────────────────────
        llm = get_chat_llm()
        try:
            structured_llm = llm.with_structured_output(QAResponse)
            response = structured_llm.invoke(messages)
            if isinstance(response, dict):
                answer_text = response.get("answer") or ""
                raw_highlight = (response.get("highlight_node_id") or "").strip()
                code_ref = response.get("code_ref") if isinstance(response.get("code_ref"), dict) else None
            else:
                answer_text = getattr(response, "answer", "") or ""
                raw_highlight = (getattr(response, "highlight_node_id", "") or "").strip()
                code_ref = getattr(response, "code_ref", None)
        except Exception as struct_err:
            logger.warning(f"QA Agent: with_structured_output failed ({struct_err}), using plain invoke fallback")
            try:
                raw_response = invoke_with_fallback(llm, messages)
                answer_text = (getattr(raw_response, "content", "") or "").strip()
                raw_highlight = ""
                code_ref = None
            except Exception as fallback_err:
                logger.error(f"QA Agent: Plain fallback invoke failed: {fallback_err}")
                answer_text = ""
                raw_highlight = ""
                code_ref = None

        # ── 7. Validate highlight node id (strict exact match) ───────────────
        validated_highlight = _validate_node_id(raw_highlight, valid_node_ids)

        logger.info(
            f"QA Agent: Answered '{question[:60]}...' | "
            f"{len(chunks)}/{len(raw_chunks)} chunks kept | "
            f"highlight={validated_highlight or 'none'}"
        )

        return {
            "answer": answer_text or "I couldn't generate a response. Please try again.",
            "retrieved_chunks": chunks,
            "highlight_node_id": validated_highlight,
            "code_ref": code_ref,
            "source_files": source_files,
            "rewritten_question": rewritten_question,
        }

    except Exception as e:
        logger.error(f"QA Agent: Unexpected error — {e}", exc_info=True)
        return {
            "error": str(e),
            "answer": (
                "I encountered an unexpected error while searching the codebase. "
                "Please try again."
            ),
            "source_files": [],
        }


# ── Streaming API ─────────────────────────────────────────────────────────────
# This is the streaming path used by the chat router (commit 2).
# It still uses the LangGraph `qa_graph`, but calls `.astream()` to yield
# intermediate events. The router wraps it in an SSE response.
#
# Event shape (JSON):
#   {"type": "session",   "session_id": "..."}
#   {"type": "token",     "delta": "..."}                # per-token from the LLM
#   {"type": "sources",   "files": [...], "highlight_node_id": "...", "code_ref": {...}}
#   {"type": "done"}                                    # final event
#   {"type": "error",    "message": "..."}              # on failure


async def astream_qa_answer(
    *,
    question: str,
    repo_id: str,
    session_id: str,
    chat_history: Optional[List] = None,
    valid_node_ids: Optional[List[str]] = None,
) -> "AsyncGenerator[Dict[str, Any], None]":
    """
    Streaming QA answer. Yields SSE-shaped dicts.
    Falls back gracefully on errors so the client always gets a `done` event.

    In addition to the user-facing events (session, token, sources, done, error),
    this generator also yields a final `metrics` event with telemetry for the
    router to persist to the qa_queries table.
    """
    import time as _time
    from langchain_core.messages import BaseMessage
    chat_history = chat_history or []
    valid_node_ids = valid_node_ids or []

    started_at = _time.monotonic()
    retrieval_ms = 0
    llm_ms = 0
    num_chunks_retrieved = 0
    num_chunks_kept = 0

    # Always emit the session event first so the client can record it.
    yield {"type": "session", "session_id": session_id}

    try:
        # 1. Query rewriting (always run — falls back gracefully if no history)
        rewritten_question = question
        try:
            rewritten_question = await rewrite_query(question, chat_history)
        except Exception as e:
            logger.warning(f"QA stream: rewrite failed ({e}), using original")
            rewritten_question = question

        # 2. Embed (async to avoid blocking the event loop)
        embeddings_client = get_embeddings()
        try:
            query_vector = await embeddings_client.embed_query_async(rewritten_question)
        except Exception as embed_err:
            yield {"type": "error", "message": f"Embedding service unavailable: {embed_err}"}
            yield {
                "type": "metrics",
                "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
                "num_chunks_retrieved": 0,
                "num_chunks_kept": 0,
                "latency_retrieval_ms": 0,
                "latency_llm_ms": 0,
                "rewritten_question": rewritten_question,
            }
            yield {"type": "done"}
            return

        # 3. Retrieve
        retrieval_start = _time.monotonic()
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        client = get_chroma_client()
        try:
            collection = client.get_collection(name=collection_name)
        except Exception:
            yield {
                "type": "token",
                "delta": (
                    "This repository hasn't been indexed for semantic search yet. "
                    "Please re-run the analysis to enable Q&A on the codebase."
                ),
            }
            yield {"type": "sources", "files": [], "highlight_node_id": "", "code_ref": None}
            yield {
                "type": "metrics",
                "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
                "num_chunks_retrieved": 0,
                "num_chunks_kept": 0,
                "latency_retrieval_ms": 0,
                "latency_llm_ms": 0,
                "rewritten_question": rewritten_question,
            }
            yield {"type": "done"}
            return

        results = collection.query(
            query_embeddings=[query_vector],
            n_results=min(TOP_K, collection.count()),
        )
        raw_chunks = results.get("documents", [[]])[0]
        raw_metadatas = results.get("metadatas", [[]])[0]
        raw_distances = (results.get("distances") or [[]])[0]
        num_chunks_retrieved = len(raw_chunks)

        if not raw_chunks:
            yield {
                "type": "token",
                "delta": (
                    "I searched the codebase index but couldn't find any relevant code "
                    "for your question. Try rephrasing or asking about a specific file or component."
                ),
            }
            yield {"type": "sources", "files": [], "highlight_node_id": "", "code_ref": None}
            yield {
                "type": "metrics",
                "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
                "num_chunks_retrieved": 0,
                "num_chunks_kept": 0,
                "latency_retrieval_ms": int((_time.monotonic() - retrieval_start) * 1000),
                "latency_llm_ms": 0,
                "rewritten_question": rewritten_question,
            }
            yield {"type": "done"}
            return

        # Apply relevance threshold + filter out embed_failed chunks
        chunks: List[str] = []
        metadatas: List[Dict] = []
        ranked_pairs_stream = []  # (dist, chunk, meta) for adaptive fallback
        for chunk, meta, dist in zip(raw_chunks, raw_metadatas, raw_distances or [0.0] * len(raw_chunks)):
            if meta.get("embed_failed"):
                continue
            d = dist if dist is not None else 1.0
            ranked_pairs_stream.append((d, chunk, meta))
            if not (raw_distances and d > RELEVANCE_THRESHOLD):
                chunks.append(chunk)
                metadatas.append(meta)
        retrieval_ms = int((_time.monotonic() - retrieval_start) * 1000)

        if not chunks:
            # Adaptive fallback: use the N closest chunks so the LLM still runs.
            ranked_pairs_stream.sort(key=lambda x: x[0])
            best = ranked_pairs_stream[:RELEVANCE_FLOOR_CHUNKS]
            if best:
                logger.warning(
                    f"QA stream: All chunks exceeded threshold; using top-{len(best)} closest "
                    f"(distances: {[round(d,3) for d,_,_ in best]}) as best-effort context."
                )
                chunks = [c for _, c, _ in best]
                metadatas = [m for _, _, m in best]
            else:
                yield {
                    "type": "token",
                    "delta": (
                        "I searched the codebase but couldn't find any relevant code for your question. "
                        "Try rephrasing or asking about a specific file or function."
                    ),
                }
                yield {"type": "sources", "files": [], "highlight_node_id": "", "code_ref": None}
                yield {
                    "type": "metrics",
                    "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
                    "num_chunks_retrieved": num_chunks_retrieved,
                    "num_chunks_kept": 0,
                    "latency_retrieval_ms": retrieval_ms,
                    "latency_llm_ms": 0,
                    "rewritten_question": rewritten_question,
                }
                yield {"type": "done"}
                return

        num_chunks_kept = len(chunks)

        # 4. Build context + LLM messages
        context_parts = []
        for chunk, meta in zip(chunks, metadatas):
            file_path = meta.get("path", "unknown")
            language = meta.get("language", "")
            context_parts.append(
                f"### File: `{file_path}`\n```{language}\n{chunk.strip()}\n```"
            )
        context_str = "\n\n".join(context_parts)

        source_files = list(dict.fromkeys(
            m.get("path", "") for m in metadatas if m.get("path")
        ))[:8]

        messages = [
            SystemMessage(content=_build_system_prompt(valid_node_ids)),
            SystemMessage(content=f"## Retrieved Code Context:\n\n{context_str}"),
        ]
        if chat_history:
            history_slice = chat_history[-12:]
            approx_tokens = 0
            kept = []
            for msg in reversed(history_slice):
                content = getattr(msg, "content", "") or ""
                approx_tokens += len(content) // 4
                if approx_tokens > MAX_HISTORY_TOKENS:
                    break
                kept.append(msg)
            kept.reverse()
            messages.extend(kept)
        messages.append(HumanMessage(content=question))

        # 5. Stream the LLM response
        llm_start = _time.monotonic()
        from app.core.llm import invoke_with_fallback, get_chat_llm
        llm = get_chat_llm()

        # We stream raw text (not structured output) so the user sees tokens
        # arrive in real time. The structured parse happens at the end of the stream.
        full_text = ""
        try:
            stream = llm.stream(messages)
            for chunk in stream:
                delta = getattr(chunk, "content", None) or ""
                if delta:
                    full_text += delta
                    yield {"type": "token", "delta": delta}
        except Exception as stream_err:
            logger.warning(f"QA stream: streaming failed ({stream_err}), falling back to invoke")
            try:
                resp = invoke_with_fallback(llm, messages)
                full_text = getattr(resp, "content", "") or ""
                if full_text:
                    yield {"type": "token", "delta": full_text}
            except Exception as invoke_err:
                yield {"type": "error", "message": f"LLM call failed: {invoke_err}"}
                yield {
                    "type": "metrics",
                    "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
                    "num_chunks_retrieved": num_chunks_retrieved,
                    "num_chunks_kept": num_chunks_kept,
                    "latency_retrieval_ms": retrieval_ms,
                    "latency_llm_ms": int((_time.monotonic() - llm_start) * 1000),
                    "rewritten_question": rewritten_question,
                    "error": str(invoke_err),
                }
                yield {"type": "done"}
                return
        llm_ms = int((_time.monotonic() - llm_start) * 1000)

        if not full_text.strip():
            yield {"type": "error", "message": "Empty response from model"}
            yield {
                "type": "metrics",
                "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
                "num_chunks_retrieved": num_chunks_retrieved,
                "num_chunks_kept": num_chunks_kept,
                "latency_retrieval_ms": retrieval_ms,
                "latency_llm_ms": llm_ms,
                "rewritten_question": rewritten_question,
            }
            yield {"type": "done"}
            return

        # 6. Parse the structured `---METADATA---` tail (kept for backwards compat
        # with non-structured models that still emit it). If the LLM didn't emit
        # one, we just send the source files + no highlight.
        highlight_node_id = ""
        code_ref = None
        answer_text = full_text
        if "---METADATA---" in full_text:
            try:
                parts = full_text.split("---METADATA---", 1)
                answer_text = parts[0].strip()
                metadata_raw = parts[1].strip().strip("`").strip()
                if metadata_raw.startswith("json"):
                    metadata_raw = metadata_raw[4:].strip()
                metadata = json.loads(metadata_raw)
                highlight_node_id = _validate_node_id(
                    metadata.get("highlight_node_id", "") or "", valid_node_ids
                )
                if isinstance(metadata.get("code_ref"), dict):
                    code_ref = metadata.get("code_ref")
            except Exception as parse_err:
                logger.warning(f"QA stream: metadata parse failed ({parse_err})")
                answer_text = full_text

        # 7. Emit final events
        yield {
            "type": "sources",
            "files": source_files,
            "highlight_node_id": highlight_node_id,
            "code_ref": code_ref,
        }
        yield {
            "type": "metrics",
            "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
            "num_chunks_retrieved": num_chunks_retrieved,
            "num_chunks_kept": num_chunks_kept,
            "latency_retrieval_ms": retrieval_ms,
            "latency_llm_ms": llm_ms,
            "rewritten_question": rewritten_question,
            "highlight_node_id": highlight_node_id,
            "answer_length_chars": len(full_text),
        }
        yield {"type": "done"}

        logger.info(
            f"QA stream: Answered '{question[:60]}' | "
            f"{num_chunks_kept}/{num_chunks_retrieved} chunks kept | "
            f"highlight={highlight_node_id or 'none'} | "
            f"len={len(full_text)} | "
            f"total={int((_time.monotonic() - started_at) * 1000)}ms"
        )

    except Exception as e:
        logger.error(f"QA stream: Unexpected error — {e}", exc_info=True)
        yield {"type": "error", "message": str(e)}
        yield {
            "type": "metrics",
            "latency_total_ms": int((_time.monotonic() - started_at) * 1000),
            "num_chunks_retrieved": num_chunks_retrieved,
            "num_chunks_kept": num_chunks_kept,
            "latency_retrieval_ms": retrieval_ms,
            "latency_llm_ms": llm_ms,
            "error": str(e),
        }
        yield {"type": "done"}
