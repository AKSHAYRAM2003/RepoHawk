"""
Unit Tests for Step 2: Agent State Definition
Validates that all state types are well-formed, instantiable,
and that LangGraph can use them as graph state.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.state import (
    ParsedFile,
    ReactFlowNode,
    ReactFlowEdge,
    CodeRef,
    AnalysisState,
    QAState,
)
from langchain_core.messages import HumanMessage, AIMessage


def test_parsed_file_creation():
    """ParsedFile can be constructed with proper fields"""
    f = ParsedFile(
        path="src/auth/service.py",
        language="python",
        content="class AuthService: pass",
        chunks=["class AuthService: pass"],
    )
    assert f["path"] == "src/auth/service.py"
    assert f["language"] == "python"
    assert len(f["chunks"]) == 1
    print("✅ ParsedFile creation works")


def test_reactflow_node_creation():
    """ReactFlowNode can be constructed"""
    node = ReactFlowNode(
        id="auth_module",
        type="module",
        position={"x": 0, "y": 0},
        data={"label": "AuthService", "files": ["src/auth/service.py"]},
    )
    assert node["id"] == "auth_module"
    assert node["data"]["label"] == "AuthService"
    print("✅ ReactFlowNode creation works")


def test_reactflow_edge_creation():
    """ReactFlowEdge can be constructed"""
    edge = ReactFlowEdge(
        id="e-auth-db",
        source="auth_module",
        target="db_module",
        label="imports",
        animated=True,
    )
    assert edge["source"] == "auth_module"
    assert edge["target"] == "db_module"
    assert edge["animated"] is True
    print("✅ ReactFlowEdge creation works")


def test_code_ref_creation():
    """CodeRef can be constructed"""
    ref = CodeRef(file="src/auth/service.py", line_start=42, line_end=67)
    assert ref["file"] == "src/auth/service.py"
    assert ref["line_end"] - ref["line_start"] == 25
    print("✅ CodeRef creation works")


def test_analysis_state_partial_creation():
    """AnalysisState uses total=False, so partial dicts are valid (LangGraph builds incrementally)"""
    state: AnalysisState = {
        "repo_url": "https://github.com/owner/repo",
        "repo_id": "abc-123",
    }
    assert state["repo_url"].startswith("https://")
    assert "cloned_path" not in state  # Not set yet — that's fine with total=False
    print("✅ AnalysisState partial creation works (total=False)")


def test_analysis_state_full_creation():
    """AnalysisState can hold all fields when pipeline is complete"""
    state: AnalysisState = {
        "repo_url": "https://github.com/owner/repo",
        "repo_id": "abc-123",
        "cloned_path": "/tmp/repohawk/abc-123",
        "parsed_files": [],
        "total_files": 42,
        "successfully_parsed": 38,
        "embeddings_stored": True,
        "mermaid_syntax": "graph TD\n  A-->B",
        "reactflow_nodes": [{"id": "A", "type": "module", "position": {"x": 0, "y": 0}, "data": {"label": "A"}}],
        "reactflow_edges": [{"id": "e1", "source": "A", "target": "B"}],
        "confidence_level": "high",
        "confidence_file_count": 38,
        "critique_passed": True,
        "critique_feedback": "",
        "retry_count": 0,
        "diagram_id": "diagram-uuid-456",
        "current_step": "complete",
        "progress_log": ["Cloning...", "Parsing...", "Done"],
        "error": "",
    }
    assert state["confidence_level"] == "high"
    assert state["total_files"] == 42
    assert len(state["progress_log"]) == 3
    print("✅ AnalysisState full creation works")


def test_qa_state_creation():
    """QAState can be constructed with chat history"""
    state: QAState = {
        "repo_id": "abc-123",
        "session_id": "session-789",
        "question": "Where is authentication handled?",
        "chat_history": [
            HumanMessage(content="What does this repo do?"),
            AIMessage(content="This is a FastAPI application..."),
        ],
        "retrieved_chunks": ["class AuthService...", "def verify_token..."],
        "answer": "Auth is in src/auth/service.py",
        "highlight_node_id": "auth_module",
        "code_ref": {"file": "src/auth/service.py", "line_start": 42, "line_end": 67},
        "source_files": ["src/auth/service.py", "src/middleware/jwt.py"],
        "error": "",
    }
    assert len(state["chat_history"]) == 2
    assert state["highlight_node_id"] == "auth_module"
    assert state["code_ref"]["line_start"] == 42
    print("✅ QAState creation with chat history works")


def test_qa_state_empty_history():
    """QAState works for first message (empty history)"""
    state: QAState = {
        "repo_id": "abc-123",
        "session_id": "new-session",
        "question": "What does this repo do?",
        "chat_history": [],
    }
    assert len(state["chat_history"]) == 0
    print("✅ QAState empty history works (first message)")


def test_analysis_and_qa_are_separate():
    """AnalysisState and QAState don't share fields they shouldn't"""
    analysis_fields = set(AnalysisState.__annotations__.keys())
    qa_fields = set(QAState.__annotations__.keys())

    # These should be shared (both need repo_id & error)
    shared = analysis_fields & qa_fields
    assert "repo_id" in shared, "Both states need repo_id"
    assert "error" in shared, "Both states need error"

    # These should NOT be in QA
    assert "cloned_path" not in qa_fields, "QA shouldn't know about cloning"
    assert "parsed_files" not in qa_fields, "QA shouldn't hold parsed files"

    # These should NOT be in Analysis
    assert "question" not in analysis_fields, "Analysis doesn't handle questions"
    assert "answer" not in analysis_fields, "Analysis doesn't produce answers"

    print(f"✅ States are properly separated (shared: {shared})")


if __name__ == "__main__":
    print("\n🧪 Running Step 2 Unit Tests: Agent State Definition\n" + "=" * 55)
    test_parsed_file_creation()
    test_reactflow_node_creation()
    test_reactflow_edge_creation()
    test_code_ref_creation()
    test_analysis_state_partial_creation()
    test_analysis_state_full_creation()
    test_qa_state_creation()
    test_qa_state_empty_history()
    test_analysis_and_qa_are_separate()
    print("\n" + "=" * 55)
    print("✅ All 9 tests passed! Step 2 complete.\n")
