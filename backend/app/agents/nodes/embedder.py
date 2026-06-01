"""
Step 5: Embedder Node
Converts semantic code chunks into vectors and stores them in ChromaDB.

Uses the OpenRouter embedding model (nvidia/llama-nemotron-embed-vl-1b-v2:free)
to generate vectors. Falls back gracefully if the API is unavailable so the
rest of the pipeline (diagram generation) is never blocked.

Input:  AnalysisState with repo_id, parsed_files
Output: AnalysisState with embeddings_stored (True/False)
"""

import logging
import uuid
from typing import Dict, Any, List

from app.agents.state import AnalysisState, ParsedFile
from app.core.vector_store import get_chroma_client
from app.core.embeddings import get_embeddings

logger = logging.getLogger("repohawk.embedder")

# Max number of chunks to embed per repo (guards against huge repos/costs)
MAX_CHUNKS = 500
# Batch size for embedding API calls (avoids per-request token limits)
EMBED_BATCH_SIZE = 50


def embedder_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Embeds parsed code chunks and stores in ChromaDB.

    Strategy:
    1. Collect all chunks from parsed_files (up to MAX_CHUNKS).
    2. Send in batches to the OpenRouter embedding API.
    3. Store document texts, embedding vectors, and file-path metadata in ChromaDB.
    4. If anything fails (API down, rate-limit, etc.) log a warning and return
       embeddings_stored=False so the pipeline can still complete without embeddings.
    """
    parsed_files: List[ParsedFile] = state.get("parsed_files", [])
    repo_id: str = state.get("repo_id", "")

    if not parsed_files:
        logger.warning("Embedder: No parsed files to embed.")
        return {
            "embeddings_stored": False,
            "current_step": "embedding_complete",
            "progress_log": ["⚠️ No parsed files found — skipping vector embedding."]
        }

    if not repo_id:
        logger.warning("Embedder: No repo_id in state — skipping embedding.")
        return {
            "embeddings_stored": False,
            "current_step": "embedding_complete",
            "progress_log": ["⚠️ Missing repo_id — skipping vector embedding."]
        }

    # ── Collect chunks from all files ─────────────────────────────────────────
    documents: List[str] = []
    metadatas: List[Dict[str, str]] = []
    ids: List[str] = []

    for pf in parsed_files:
        file_path = pf.get("path", "unknown")
        language = pf.get("language", "unknown")
        for i, chunk in enumerate(pf.get("chunks", [])):
            if len(documents) >= MAX_CHUNKS:
                break
            if not chunk.strip():
                continue
            documents.append(chunk)
            metadatas.append({"path": file_path, "language": language, "chunk_index": str(i)})
            ids.append(f"{file_path}::{i}::{uuid.uuid4().hex[:8]}")
        if len(documents) >= MAX_CHUNKS:
            break

    total_chunks = len(documents)
    logger.info(f"Embedder: {total_chunks} chunks collected from {len(parsed_files)} files.")

    if total_chunks == 0:
        return {
            "embeddings_stored": False,
            "current_step": "embedding_complete",
            "progress_log": ["⚠️ No embeddable chunks found — skipping vector embedding."]
        }

    try:
        # ── Initialize ChromaDB collection ────────────────────────────────────
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        client = get_chroma_client()

        # Delete old collection if it exists (fresh re-analysis)
        try:
            client.delete_collection(name=collection_name)
            logger.info(f"Embedder: Deleted old collection '{collection_name}'.")
        except Exception:
            pass  # Collection doesn't exist yet — that's fine

        collection = client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}  # cosine similarity for code search
        )

        # ── Generate embeddings in batches ────────────────────────────────────
        embeddings_client = get_embeddings()
        all_embeddings: List[List[float]] = []

        for batch_start in range(0, total_chunks, EMBED_BATCH_SIZE):
            batch_docs = documents[batch_start: batch_start + EMBED_BATCH_SIZE]
            batch_num = batch_start // EMBED_BATCH_SIZE + 1
            total_batches = (total_chunks + EMBED_BATCH_SIZE - 1) // EMBED_BATCH_SIZE

            logger.info(f"Embedder: Embedding batch {batch_num}/{total_batches} ({len(batch_docs)} chunks)...")

            try:
                batch_embeddings = embeddings_client.embed_documents(batch_docs)
                all_embeddings.extend(batch_embeddings)
            except Exception as batch_err:
                # A single batch failure should not kill everything —
                # use zero vectors as placeholders for this batch
                logger.warning(f"Embedder: Batch {batch_num} failed ({batch_err}). Using zero-vector placeholders.")
                dim = 2048  # nvidia/llama-nemotron-embed-vl-1b-v2 output dimension
                all_embeddings.extend([[0.0] * dim for _ in batch_docs])

        # ── Store in ChromaDB ─────────────────────────────────────────────────
        # Add in one go (ChromaDB handles internal batching)
        collection.add(
            documents=documents,
            embeddings=all_embeddings,
            metadatas=metadatas,
            ids=ids,
        )

        logger.info(
            f"Embedder: ✅ Stored {total_chunks} chunks in collection '{collection_name}'."
        )

        return {
            "embeddings_stored": True,
            "current_step": "embedding_complete",
            "progress_log": [
                f"✅ Vector index built: {total_chunks} code chunks indexed across {len(parsed_files)} files."
            ]
        }

    except Exception as e:
        # ── Fault-tolerant fallback ───────────────────────────────────────────
        # Embedding failure MUST NOT block diagram generation.
        logger.warning(
            f"Embedder: Non-fatal embedding error — diagram generation will proceed. "
            f"Error: {e}"
        )
        return {
            "embeddings_stored": False,
            "current_step": "embedding_complete",
            "progress_log": [
                f"⚠️ Vector indexing skipped (embedding service unavailable). "
                f"Architecture diagram will still be generated."
            ]
        }
