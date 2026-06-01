"""
Step 9: QA Agent Node
Handles user questions by retrieving relevant code chunks via RAG and generating
grounded, honest answers using the LLM.

Fixes vs original:
  - Uses query_embeddings (not query_texts) to avoid ChromaDB dimension mismatch
  - Uses the same OpenRouterEmbeddings client used during indexing
  - System prompt enforces Claude-style honesty: admits uncertainty clearly
  - Robust metadata parsing with multiple fallback strategies

Input:  QAState with question, repo_id, session_id, chat_history
Output: QAState with answer, retrieved_chunks, highlight_node_id,
        code_ref, source_files
"""

import json
import logging
from typing import Dict, Any, List

from app.agents.state import QAState, CodeRef
from app.core.llm import get_chat_llm, invoke_with_fallback
from app.core.embeddings import get_embeddings
from app.core.vector_store import get_chroma_client
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

logger = logging.getLogger("repohawk.qa_agent")

# ── System Prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are RepoHawk, an expert AI assistant specialized in codebase exploration and architecture analysis.

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

## Output Format:
Write your natural language answer first, then end with EXACTLY this block:

---METADATA---
{
  "highlight_node_id": "the-node-id-from-diagram-that-best-matches-the-answer-or-empty-string",
  "code_ref": { "file": "path/to/most/relevant/file.py", "line_start": 1, "line_end": 1 },
  "source_files": ["file1.py", "file2.py"]
}

If you cannot determine a highlight node, use an empty string "". Never fabricate node IDs.
"""

# Number of chunks to retrieve from ChromaDB
TOP_K = 6


def qa_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: RAG-powered Q&A over the indexed codebase.

    Steps:
      1. Embed the user question using the same model used during indexing
      2. Query ChromaDB with the vector (avoids dimension mismatch)
      3. Build a grounded LLM prompt with retrieved context
      4. Parse the structured metadata from the LLM response
    """
    question = state.get("question", "").strip()
    repo_id = state.get("repo_id", "")
    chat_history = state.get("chat_history", [])

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
        # ── 1. Embed the question ─────────────────────────────────────────────
        # CRITICAL: Use the same model used during indexing so dimensions match.
        # Querying with query_texts would use ChromaDB's default model (384-dim),
        # which would crash against our 2048-dim indexed vectors.
        embeddings_client = get_embeddings()
        try:
            query_vector = embeddings_client.embed_query(question)
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

        # ── 2. Retrieve from ChromaDB ─────────────────────────────────────────
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        client = get_chroma_client()

        try:
            collection = client.get_collection(name=collection_name)
        except Exception:
            logger.warning(f"QA Agent: Collection '{collection_name}' not found. "
                           f"The repository may not have been indexed yet.")
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

        chunks: List[str] = results.get("documents", [[]])[0]
        metadatas: List[Dict] = results.get("metadatas", [[]])[0]

        if not chunks:
            return {
                "answer": (
                    "I searched the codebase index but couldn't find any relevant code "
                    "for your question. Try rephrasing or asking about a specific file or component."
                ),
                "source_files": [],
                "retrieved_chunks": [],
            }

        # ── 3. Build context string ───────────────────────────────────────────
        context_parts = []
        for chunk, meta in zip(chunks, metadatas):
            file_path = meta.get("path", "unknown")
            language = meta.get("language", "")
            context_parts.append(
                f"### File: `{file_path}`\n```{language}\n{chunk.strip()}\n```"
            )
        context_str = "\n\n".join(context_parts)

        source_files = list(dict.fromkeys(  # Preserve order, deduplicate
            m.get("path", "") for m in metadatas if m.get("path")
        ))

        # ── 4. Build LLM messages ─────────────────────────────────────────────
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            SystemMessage(content=f"## Retrieved Code Context:\n\n{context_str}"),
        ]

        # Add recent chat history (last 6 turns to avoid token overflow)
        if chat_history:
            messages.extend(chat_history[-6:])

        messages.append(HumanMessage(content=question))

        # ── 5. Invoke LLM ─────────────────────────────────────────────────────
        llm = get_chat_llm()
        response = invoke_with_fallback(llm, messages)
        raw_content: str = response.content or ""

        # ── 6. Parse metadata block ───────────────────────────────────────────
        answer_text = raw_content
        highlight_node_id = ""
        code_ref: Dict = {}
        parsed_source_files = source_files  # Default to retrieval sources

        if "---METADATA---" in raw_content:
            parts = raw_content.split("---METADATA---", 1)
            answer_text = parts[0].strip()
            metadata_raw = parts[1].strip()

            # Try to parse — handle cases where LLM wraps in code fences
            metadata_raw = metadata_raw.strip("`").strip()
            if metadata_raw.startswith("json"):
                metadata_raw = metadata_raw[4:].strip()

            try:
                metadata = json.loads(metadata_raw)
                highlight_node_id = metadata.get("highlight_node_id", "") or ""
                code_ref = metadata.get("code_ref", {}) or {}
                llm_sources = metadata.get("source_files", [])
                if llm_sources:
                    parsed_source_files = llm_sources
            except json.JSONDecodeError as je:
                logger.warning(f"QA Agent: Could not parse metadata JSON — {je}. Using raw answer.")
                # Don't fail — just use the full raw content as the answer
                answer_text = raw_content

        logger.info(
            f"QA Agent: Answered '{question[:60]}...' | "
            f"{len(chunks)} chunks retrieved | "
            f"highlight={highlight_node_id or 'none'}"
        )

        return {
            "answer": answer_text,
            "retrieved_chunks": chunks,
            "highlight_node_id": highlight_node_id,
            "code_ref": code_ref if code_ref else None,
            "source_files": parsed_source_files,
        }

    except Exception as e:
        logger.error(f"QA Agent: Unexpected error — {e}", exc_info=True)
        return {
            "error": str(e),
            "answer": (
                f"I encountered an unexpected error while searching the codebase. "
                f"Please try again."
            ),
            "source_files": [],
        }
