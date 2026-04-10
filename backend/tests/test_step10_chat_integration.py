"""
Integration Tests for Step 10 (Chat): FastAPI Wiring
"""

import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_chat_endpoint_wiring():
    payload = {
        "repo_id": "test-repo-uuid",
        "query": "What is this?",
    }

    mock_qa_output = {
        "answer": "This is a test.",
        "session_id": "session-123",
        "highlight_node_id": "node-1",
        "source_files": ["a.py"],
    }

    with patch("app.api.v1.routers.chat.qa_graph") as mock_graph:
        mock_graph.invoke.return_value = mock_qa_output
        response = client.post("/api/v1/chat/", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "This is a test."
    assert data["highlight_node_id"] == "node-1"

