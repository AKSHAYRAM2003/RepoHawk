"""
Step 5: Embedder Node
Converts semantic code chunks into vectors and stores them in ChromaDB.

For MVP: Fast-passes through the pipeline (skips actual embedding) so the
architecture diagram feature can be tested without ChromaDB overhead.
"""

import logging
from typing import Dict, Any, List
from app.agents.state import AnalysisState, ParsedFile

logger = logging.getLogger("repohawk.embedder")

def embedder_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Fast-pass through embedder for MVP speed.
    Skips ChromaDB embedding (non-critical for diagram generation).
    """
    parsed_files: List[ParsedFile] = state.get("parsed_files", [])
    chunk_count = sum(len(pf["chunks"]) for pf in parsed_files) if parsed_files else 0
    
    logger.info(f"Embedder skipped for MVP speed ({chunk_count} chunks available but not embedded yet)")
    
    return {
        "embeddings_stored": False,
        "current_step": "embedding_complete",
        "progress_log": [f"ℹ️ Vector search skipped (available when ChromaDB embedding is enabled)"]
    }
