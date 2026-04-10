"""
Step 5: Embedder Node
Converts semantic code chunks into vectors and stores them in ChromaDB.
This enables RAG (Retrieval Augmented Generation) for the chat agent.

Input:  AnalysisState with parsed_files, repo_id
Output: AnalysisState with embeddings_stored, current_step, progress_log
"""

import os
from typing import Dict, Any, List
from app.agents.state import AnalysisState, ParsedFile
from app.core.embeddings import get_embeddings
from app.core.vector_store import get_chroma_client
import chromadb

def embedder_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Vectorizes and stores code chunks in ChromaDB.
    """
    repo_id = state.get("repo_id")
    parsed_files: List[ParsedFile] = state.get("parsed_files", [])

    if not repo_id:
        return {
            "error": "Missing repo_id in state",
            "current_step": "error",
            "progress_log": ["❌ Error: Missing repo_id for embedding"]
        }

    if not parsed_files:
        return {
            "error": "No parsed files found to embed",
            "current_step": "error",
            "progress_log": ["❌ Error: No files were successfully parsed"]
        }

    try:
        # 1. Initialize Embedding Model
        embeddings_model = get_embeddings()
        
        # 2. Get Chroma Client and Collection
        client = get_chroma_client()
        collection_name = f"repo_{repo_id.replace('-', '_')}" # Chroma collection name safety
        
        # Delete old collection if it exists to ensure freshness
        try:
            client.delete_collection(name=collection_name)
        except:
            pass
            
        collection = client.create_collection(name=collection_name)

        # 3. Prepare data for batch insertion
        documents = []
        metadatas = []
        ids = []
        
        chunk_count = 0
        for pf in parsed_files:
            file_path = pf["path"]
            language = pf["language"]
            
            for i, chunk in enumerate(pf["chunks"]):
                # Create a unique ID for each chunk
                chunk_id = f"{file_path}_chunk_{i}"
                
                documents.append(chunk)
                metadatas.append({
                    "path": file_path,
                    "language": language,
                    "repo_id": repo_id
                })
                ids.append(chunk_id)
                chunk_count += 1

        # 4. Perform Embedding and Insertion
        # We use a batch size to avoid hitting URL length limits or timeouts
        batch_size = 100
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i : i + batch_size]
            batch_metas = metadatas[i : i + batch_size]
            batch_ids = ids[i : i + batch_size]
            
            # Generate vectors
            batch_vectors = embeddings_model.embed_documents(batch_docs)
            
            # Add to Chroma
            collection.add(
                embeddings=batch_vectors,
                documents=batch_docs,
                metadatas=batch_metas,
                ids=batch_ids
            )

        return {
            "embeddings_stored": True,
            "current_step": "embedding_complete",
            "progress_log": [f"✅ Successfully embedded {chunk_count} code chunks across {len(parsed_files)} files"]
        }

    except Exception as e:
        return {
            "error": f"Embedding failed: {str(e)}",
            "current_step": "error",
            "progress_log": [f"❌ Embedding failed: {str(e)}"]
        }
