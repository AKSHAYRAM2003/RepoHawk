"""
Unit Tests for Step 8: LangGraph Orchestrator
Tests graph topology, conditional edges, and overall execution flow.
"""

import sys
import os
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.graph import create_analysis_graph, should_continue_after_critique

def test_should_continue_after_critique():
    """Verify conditional edge logic for passing, failing, and max retries"""
    
    # Case 1: Pass
    state_pass = {"critique_passed": True, "retry_count": 1}
    assert should_continue_after_critique(state_pass) == "end"
    
    # Case 2: Fail, low retry count -> retry
    state_fail_retry = {"critique_passed": False, "retry_count": 1}
    assert should_continue_after_critique(state_fail_retry) == "architect"
    
    # Case 3: Fail, max retry count -> end
    state_fail_max = {"critique_passed": False, "retry_count": 3}
    assert should_continue_after_critique(state_fail_max) == "end"
    
    print("✅ Conditional edge logic 'should_continue_after_critique' verified")

def test_graph_execution_flow():
    """Verify nodes are called in the expected sequence using mock nodes"""
    
    # Mock all nodes to return minimal valid state updates
    mock_cloner = MagicMock(side_effect=lambda s: {"cloned_path": "/tmp/test"})
    mock_parser = MagicMock(side_effect=lambda s: {"parsed_files": [{"path": "a.py"}]})
    mock_embedder = MagicMock(side_effect=lambda s: {"embeddings_stored": True})
    mock_architect = MagicMock(side_effect=lambda s: {"reactflow_nodes": [], "reactflow_edges": []})
    # First critique fails, second succeeds
    mock_critique = MagicMock()
    mock_critique.side_effect = [
        {"critique_passed": False, "retry_count": 1},
        {"critique_passed": True, "retry_count": 2}
    ]

    # Create a fresh graph and override its nodes for testing
    # LangGraph stores nodes in a internal dict
    graph = create_analysis_graph()
    
    # We patch the nodes in the state graph before compilation if possible,
    # but here we'll patch the imports in graph.py
    with patch("app.agents.graph.git_cloner_node", mock_cloner), \
         patch("app.agents.graph.ast_parser_node", mock_parser), \
         patch("app.agents.graph.embedder_node", mock_embedder), \
         patch("app.agents.graph.architect_node", mock_architect), \
         patch("app.agents.graph.critique_node", mock_critique):
        
        # Re-compile to use patched nodes
        test_graph = create_analysis_graph()
        
        initial_state = {
            "repo_url": "https://github.com/test/repo",
            "repo_id": "test-id"
        }
        
        # Invoke the graph
        final_state = test_graph.invoke(initial_state)
        
        # Verify call chain
        assert mock_cloner.called
        assert mock_parser.called
        assert mock_embedder.called
        # Architect should be called TWICE (once initially, once after retry)
        assert mock_architect.call_count == 2
        assert mock_critique.call_count == 2
        
        # Final state should reflect successful conclusion
        assert final_state["critique_passed"] is True
        assert final_state["retry_count"] == 2
        
        print("✅ Full graph execution flow (with retry loop) verified")

if __name__ == "__main__":
    print("\n🧪 Running Step 8 Unit Tests: LangGraph Orchestrator\n" + "=" * 55)
    test_should_continue_after_critique()
    test_graph_execution_flow()
    print("\n" + "=" * 55)
    print("✅ All 2 tests passed! Step 8 complete.\n")
