"""
Unit Tests for Step 9: QA Agent Node
Tests RAG retrieval and answer generation using mocks.
"""

import sys
import os
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.nodes.qa_agent import qa_agent_node
from langchain_core.messages import AIMessage

def test_qa_agent_node_success():
    """Verify qa_agent_node performs RAG and returns formatted answer"""
    
    state = {
        "question": "How do I authenticate?",
        "repo_id": "test-repo",
        "chat_history": []
    }

    # Mock Vectors and Chroma
    mock_embeddings = MagicMock()
    mock_embeddings.embed_query.return_value = [0.1]*1536
    
    mock_collection = MagicMock()
    mock_collection.query.return_value = {
        "documents": [["class Auth: def login(self): pass"]],
        "metadatas": [[{"path": "auth.py"}]]
    }
    
    mock_chroma_client = MagicMock()
    mock_chroma_client.get_collection.return_value = mock_collection
    
    # Mock LLM
    mock_llm_response = AIMessage(content="You use the Auth class.\n---METADATA---\n{\"highlight_node_id\": \"auth-node\", \"source_files\": [\"auth.py\"]}")
    mock_llm = MagicMock()
    mock_llm.invoke.return_value = mock_llm_response

    with patch("app.agents.nodes.qa_agent.get_embeddings", return_value=mock_embeddings), \
         patch("app.agents.nodes.qa_agent.get_chroma_client", return_value=mock_chroma_client), \
         patch("app.agents.nodes.qa_agent.get_chat_llm", return_value=mock_llm):
             
        result = qa_agent_node(state)
        
        assert "You use the Auth class" in result["answer"]
        assert result["highlight_node_id"] == "auth-node"
        assert "auth.py" in result["source_files"]
        assert len(result["retrieved_chunks"]) == 1
        print("✅ QA Agent node successfully processed question with RAG")

def test_qa_agent_node_error_handling():
    """Verify qa_agent_node handles missing repo_id"""
    state = {
        "question": "Hello?",
        "repo_id": None
    }
    
    result = qa_agent_node(state)
    assert "Missing repo_id" in result["error"]
    print("✅ QA Agent node handles missing repo_id correctly")

if __name__ == "__main__":
    print("\n🧪 Running Step 9 Unit Tests: QA Agent Node\n" + "=" * 55)
    test_qa_agent_node_success()
    test_qa_agent_node_error_handling()
    print("\n" + "=" * 55)
    print("✅ All 2 tests passed! Step 9 complete.\n")
