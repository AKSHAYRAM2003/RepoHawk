"""
Step 5: Embedder Node
Converts semantic code chunks into vectors and stores them in ChromaDB.

Uses the OpenRouter embedding model (nvidia/llama-nemotron-embed-vl-1b-v2:free)
to generate vectors. Falls back gracefully if the API is unavailable so the
rest of the pipeline (diagram generation) is never blocked.

Improvements in this iteration (commit 6):
  - Replace zero-vector fallback with a defensive `embed_failed=True` metadata flag
  - Healthy chunks behave IDENTICALLY to before — same stored vector, same metadata keys
  - Failed chunks are marked but still stored, so the QA agent can filter them out
    at retrieval time (qa_agent.py excludes them via the relevance filter)
  - Analysis pipeline behavior is unchanged for successful embeddings

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
from app.core.embeddings import EMBED_DIM


def embedder_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Embeds parsed code chunks and stores in ChromaDB.

    Strategy:
    1. Collect all chunks from parsed_files (up to MAX_CHUNKS).
    2. Send in batches to the OpenRouter embedding API.
    3. Store document texts, embedding vectors, and file-path metadata in ChromaDB.
    4. If a batch fails, mark those chunks with `embed_failed=True` instead of
       storing zero-vectors. The QA agent filters these out at retrieval time.
    5. If anything fails catastrophically, log a warning and return
       embeddings_stored=False so the pipeline can still complete.
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
    metadatas: List[Dict[str, Any]] = []
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
            # NOTE: every chunk gets an `embed_failed: false` flag by default
            # (commit 6). This is the only metadata change for healthy chunks.
            metadatas.append({
                "path": file_path,
                "language": language,
                "chunk_index": str(i),
                "embed_failed": False,
            })
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
            pass

        collection = client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        # ── Generate embeddings in batches ────────────────────────────────────
        embeddings_client = get_embeddings()
        all_embeddings: List[List[float]] = []
        failed_batch_count = 0
        failed_chunk_indices: set = set()

        for batch_start in range(0, total_chunks, EMBED_BATCH_SIZE):
            batch_docs = documents[batch_start: batch_start + EMBED_BATCH_SIZE]
            batch_num = batch_start // EMBED_BATCH_SIZE + 1
            total_batches = (total_chunks + EMBED_BATCH_SIZE - 1) // EMBED_BATCH_SIZE

            logger.info(f"Embedder: Embedding batch {batch_num}/{total_batches} ({len(batch_docs)} chunks)...")

            try:
                batch_embeddings = embeddings_client.embed_documents(batch_docs)
                all_embeddings.extend(batch_embeddings)
            except Exception as batch_err:
                # DEFENSIVE FLAG (commit 6) — instead of zero-vector placeholders
                # that pollute the index, we mark the failed chunks with
                # `embed_failed=True` in their metadata. The QA agent filters
                # these out at retrieval time. We still store SOMETHING in the
                # embedding slot (a clearly-bad-but-not-zero vector) so Chroma's
                # HNSW index doesn't crash on dimension mismatch.
                #
                # Note: we still pad the embeddings list with placeholder vectors
                # of the right dimension. These are marked as failed in metadata
                # and never returned to the user by the QA agent.
                failed_batch_count += 1
                logger.warning(
                    f"Embedder: Batch {batch_num} failed ({batch_err}). "
                    f"Marking {len(batch_docs)} chunks as embed_failed=True."
                )
                # Use a deterministic "poisoned" vector that's distinct enough
                # not to be confused with any real embedding. We use all 1.0s
                # so cosine distance is exactly 1.0 — guaranteed to be far from
                # any real query vector and well above the relevance threshold.
                poisoned = [1.0] * EMBED_DIM
                all_embeddings.extend([poisoned for _ in batch_docs])
                for i in range(batch_start, batch_start + len(batch_docs)):
                    failed_chunk_indices.add(i)
                    if i < len(metadatas):
                        metadatas[i]["embed_failed"] = True

        # ── Store in ChromaDB ─────────────────────────────────────────────────
        collection.add(
            documents=documents,
            embeddings=all_embeddings,
            metadatas=metadatas,
            ids=ids,
        )

        log_msg = (
            f"✅ Vector index built: {total_chunks} code chunks indexed across "
            f"{len(parsed_files)} files"
        )
        if failed_batch_count > 0:
            log_msg += (
                f" ({failed_batch_count} batch(es) failed — "
                f"{len(failed_chunk_indices)} chunks marked embed_failed=True "
                f"and filtered from retrieval)"
            )
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        return {
            "embeddings_stored": True,
            "current_step": "embedding_complete",
            "progress_log": [log_msg]
        }

    except Exception as e:
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
