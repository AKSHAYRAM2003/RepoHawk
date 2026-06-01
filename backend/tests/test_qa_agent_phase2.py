"""
Phase 2 Test: Validates the QA Agent Node end-to-end
- Seeds ChromaDB with test code chunks
- Calls qa_agent_node with a question
- Validates the response structure

Run from /backend with:
  source .venv/bin/activate
  python tests/test_qa_agent_phase2.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import chromadb
from chromadb.config import Settings
from app.core.embeddings import get_embeddings
from app.agents.nodes.qa_agent import qa_agent_node

TEST_REPO_ID = "test-qa-phase2"
COLLECTION_NAME = f"repo_{TEST_REPO_ID.replace('-', '_')}"

# Seed documents — simulating what the embedder stores after analysis
SEED_DOCS = [
    {
        "text": """class AuthService:
    \"\"\"Handles user authentication and JWT token issuance.\"\"\"
    def __init__(self, db):
        self.db = db

    def login(self, username: str, password: str) -> dict:
        user = self.db.query(User).filter_by(username=username).first()
        if not user or not user.verify_password(password):
            raise HTTPException(status_code=401, detail=\"Invalid credentials\")
        token = create_jwt_token(user.id)
        return {\"access_token\": token, \"token_type\": \"bearer\"}""",
        "path": "app/services/auth_service.py",
        "language": "python",
    },
    {
        "text": """@router.post(\"/auth/login\")
async def login_endpoint(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    \"\"\"POST /auth/login — authenticates user and returns JWT.\"\"\"
    auth_service = AuthService(db)
    return auth_service.login(credentials.username, credentials.password)""",
        "path": "app/api/v1/auth.py",
        "language": "python",
    },
    {
        "text": """CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);""",
        "path": "migrations/001_create_users.sql",
        "language": "sql",
    },
    {
        "text": """import React, { useState } from 'react';
export function LoginForm({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/auth/login', { method: 'POST', ... });
    if (res.ok) onSuccess(await res.json());
  };
}""",
        "path": "frontend/components/LoginForm.jsx",
        "language": "javascript",
    },
]


def seed_test_collection():
    """Create a test ChromaDB collection with known content."""
    print("\n=== Phase 2 Setup: Seeding Test ChromaDB Collection ===")
    db_path = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
    client = chromadb.PersistentClient(
        path=db_path,
        settings=Settings(allow_reset=True, anonymized_telemetry=False)
    )

    # Clean up any previous run
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )

    embeddings_client = get_embeddings()
    texts = [d["text"] for d in SEED_DOCS]
    print(f"  Embedding {len(texts)} seed documents...")
    vectors = embeddings_client.embed_documents(texts)
    print(f"  ✅ Got {len(vectors)} vectors (dim={len(vectors[0])})")

    collection.add(
        documents=texts,
        embeddings=vectors,
        metadatas=[{"path": d["path"], "language": d["language"], "chunk_index": str(i)}
                   for i, d in enumerate(SEED_DOCS)],
        ids=[f"seed_chunk_{i}" for i in range(len(SEED_DOCS))],
    )
    print(f"  ✅ Seeded {len(SEED_DOCS)} chunks into '{COLLECTION_NAME}'")


def test_qa_agent():
    print("\n=== Phase 2 Test: QA Agent Node ===")

    state = {
        "repo_id": TEST_REPO_ID,
        "session_id": "test-session-001",
        "question": "How does the authentication system work?",
        "chat_history": [],
    }

    print(f"  Question: \"{state['question']}\"")
    result = qa_agent_node(state)

    # Validate response
    assert "answer" in result, "Missing 'answer' in result"
    assert result["answer"], "Answer is empty"
    assert "source_files" in result, "Missing 'source_files'"
    assert len(result.get("source_files", [])) > 0, "Expected at least one source file"

    print(f"\n  ✅ Got answer ({len(result['answer'])} chars)")
    print(f"  Source files: {result.get('source_files', [])}")
    print(f"  Highlight node: '{result.get('highlight_node_id', '')}'")
    print(f"  Code ref: {result.get('code_ref', {})}")

    print("\n  --- Answer Preview (first 600 chars) ---")
    print(result["answer"][:600])

    # Test honesty: ask something clearly not in the codebase
    print("\n=== Phase 2 Test: Honesty (Out-of-Context Question) ===")
    state2 = {
        "repo_id": TEST_REPO_ID,
        "session_id": "test-session-002",
        "question": "What is the deployment strategy for Kubernetes?",
        "chat_history": [],
    }
    print(f"  Question: \"{state2['question']}\"")
    result2 = qa_agent_node(state2)
    print(f"  Answer: {result2['answer'][:400]}")
    print("  ✅ Honesty test complete (check answer admits lack of context if K8s not in codebase)")


def cleanup():
    db_path = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
    client = chromadb.PersistentClient(
        path=db_path,
        settings=Settings(allow_reset=True, anonymized_telemetry=False)
    )
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"\n  ✅ Cleaned up test collection '{COLLECTION_NAME}'")
    except Exception:
        pass


if __name__ == "__main__":
    try:
        seed_test_collection()
        test_qa_agent()
        cleanup()
        print("\n✅ Phase 2 PASSED: QA Agent is fully functional.\n")
    except Exception as e:
        print(f"\n❌ Phase 2 FAILED: {e}\n")
        import traceback; traceback.print_exc()
        cleanup()
        sys.exit(1)
