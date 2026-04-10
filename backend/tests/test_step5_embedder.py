"""
Unit Tests for Step 5: Embedder Node
Tests code chunk vectorization and storage logic using mocks.
"""

import sys
import os
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.nodes.embedder import embedder_node
from app.agents.state import ParsedFile

def test_embedder_node_success():
    """Verify embedder_node processes files and calls chroma/embedding model correctly"""
    
    # Setup mock data
    state = {
        "repo_id": "test-repo-123",
        "parsed_files": [
            {
                "path": "src/main.py",
                "language": "python",
                "content": "def main(): print('hello')",
                "chunks": ["def main():", "print('hello')"]
            },
            {
                "path": "utils.py",
                "language": "python",
                "content": "def add(a, b): return a + b",
                "chunks": ["def add(a, b): return a + b"]
            }
        ]
    }

    # Mock Embedding Model
    mock_embeddings_model = MagicMock()
    # Return mock vectors (e.g., 3 vectors for 3 chunks)
    mock_embeddings_model.embed_documents.return_value = [[0.1]*1536, [0.2]*1536, [0.3]*1536]
    
    # Mock Chroma Client and Collection
    mock_chroma_client = MagicMock()
    mock_collection = MagicMock()
    mock_chroma_client.create_collection.return_value = mock_collection
    
    with patch("app.agents.nodes.embedder.get_embeddings", return_value=mock_embeddings_model), \
         patch("app.agents.nodes.embedder.get_chroma_client", return_value=mock_chroma_client):
        
        result = embedder_node(state)
        
        # Assertions
        assert result.get("embeddings_stored") is True
        assert result.get("current_step") == "embedding_complete"
        assert "Successfully embedded 3 code chunks" in result["progress_log"][0]
        
        # Verify chroma collection was created with safe name
        mock_chroma_client.create_collection.assert_called_with(name="repo_test_repo_123")
        
        # Verify collection.add was called
        assert mock_collection.add.called
        args, kwargs = mock_collection.add.call_args
        
        # Check lengths
        assert len(kwargs["ids"]) == 3
        assert len(kwargs["documents"]) == 3
        assert len(kwargs["metadatas"]) == 3
        assert len(kwargs["embeddings"]) == 3
        
        # Check specific ID format
        assert "src/main.py_chunk_0" in kwargs["ids"]
        assert "utils.py_chunk_0" in kwargs["ids"]
        
        print("✅ Embedder node successfully processed and stored chunks")

def test_embedder_node_missing_repo_id():
    """Verify error handling when repo_id is missing"""
    state = {
        "parsed_files": [{"path": "test.py", "chunks": ["test"]}]
    }
    
    result = embedder_node(state)
    assert result.get("error") == "Missing repo_id in state"
    assert "❌" in result["progress_log"][0]
    print("✅ Embedder node handles missing repo_id")

def test_embedder_node_empty_files():
    """Verify error handling when no parsed files are present"""
    state = {
        "repo_id": "test-repo",
        "parsed_files": []
    }
    
    result = embedder_node(state)
    assert "No parsed files found" in result.get("error")
    print("✅ Embedder node handles empty parsed_files list")

def test_embedder_node_exception():
    """Verify error handling on unexpected exceptions"""
    state = {
        "repo_id": "test-repo",
        "parsed_files": [{"path": "test.py", "chunks": ["test"]}]
    }
    
    with patch("app.agents.nodes.embedder.get_embeddings", side_effect=Exception("API Error")):
        result = embedder_node(state)
        assert "Embedding failed: API Error" in result.get("error")
        print("✅ Embedder node handles exceptions gracefully")

if __name__ == "__main__":
    print("\n🧪 Running Step 5 Unit Tests: Embedder Node\n" + "=" * 55)
    test_embedder_node_success()
    test_embedder_node_missing_repo_id()
    test_embedder_node_empty_files()
    test_embedder_node_exception()
    print("\n" + "=" * 55)
    print("✅ All 4 tests passed! Step 5 complete.\n")
