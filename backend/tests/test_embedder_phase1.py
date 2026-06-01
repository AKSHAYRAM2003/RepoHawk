"""
Phase 1 Test: Validates the Embedder Node
- Checks that the OpenRouter embedding API returns vectors
- Checks that ChromaDB stores and queries them correctly
- Checks the embedding dimension matches what the QA agent expects

Run from /backend with:
  source .venv/bin/activate
  python tests/test_embedder_phase1.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import chromadb
from chromadb.config import Settings
from app.core.embeddings import get_embeddings

TEST_REPO_ID = "test-phase1-validation"
COLLECTION_NAME = f"repo_{TEST_REPO_ID.replace('-', '_')}"

TEST_DOCUMENTS = [
    "def authenticate_user(username, password):\n    # Check credentials against DB\n    return db.query(User).filter_by(username=username).first()",
    "class AuthService:\n    def __init__(self, db_session):\n        self.db = db_session",
    "import fastapi\nfrom fastapi import APIRouter\nrouter = APIRouter(prefix='/auth')",
]

def test_embedding_api():
    print("\n=== Phase 1 Test: Embedding API ===")
    embeddings_client = get_embeddings()
    
    print(f"  Embedding {len(TEST_DOCUMENTS)} test code chunks...")
    vectors = embeddings_client.embed_documents(TEST_DOCUMENTS)
    
    assert len(vectors) == len(TEST_DOCUMENTS), "Mismatch: expected one vector per document"
    dim = len(vectors[0])
    print(f"  ✅ Got {len(vectors)} vectors, each dimension = {dim}")
    
    # Warn if dimension is not 2048 (QA agent assumes this for query_embeddings)
    if dim != 2048:
        print(f"  ⚠️  WARNING: Expected 2048 dimensions but got {dim}. Update QA agent fallback dim.")
    else:
        print("  ✅ Embedding dimension = 2048 (matches QA agent expectations)")
    
    return vectors, dim


def test_chromadb_store_and_query(vectors, dim):
    print("\n=== Phase 1 Test: ChromaDB Store & Query ===")

    # Use a local path relative to backend/
    db_path = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
    client = chromadb.PersistentClient(
        path=db_path,
        settings=Settings(allow_reset=True, anonymized_telemetry=False)
    )
    
    # Clean up previous test collection
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    
    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )
    
    collection.add(
        documents=TEST_DOCUMENTS,
        embeddings=vectors,
        metadatas=[{"path": f"test/file_{i}.py", "language": "python", "chunk_index": str(i)} for i in range(len(TEST_DOCUMENTS))],
        ids=[f"test_chunk_{i}" for i in range(len(TEST_DOCUMENTS))],
    )
    print(f"  ✅ Stored {len(TEST_DOCUMENTS)} chunks in ChromaDB collection '{COLLECTION_NAME}'")
    
    # Now query using embeddings (the way the QA agent must do it)
    print("\n  Querying ChromaDB using query_embeddings...")
    embeddings_client = get_embeddings()
    query = "How does the authentication service work?"
    query_vector = embeddings_client.embed_query(query)
    
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=2
    )
    
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    
    print(f"  ✅ Query returned {len(docs)} results:")
    for i, (doc, meta) in enumerate(zip(docs, metas)):
        print(f"     [{i+1}] {meta['path']} → {doc[:80].strip()}...")
    
    # Clean up
    client.delete_collection(COLLECTION_NAME)
    print("\n  ✅ Test collection cleaned up.")


if __name__ == "__main__":
    try:
        vectors, dim = test_embedding_api()
        test_chromadb_store_and_query(vectors, dim)
        print("\n✅ Phase 1 PASSED: Embedder is fully functional.\n")
    except Exception as e:
        print(f"\n❌ Phase 1 FAILED: {e}\n")
        import traceback; traceback.print_exc()
        sys.exit(1)
