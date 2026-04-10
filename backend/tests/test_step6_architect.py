"""
Unit Tests for Step 6: Architect Agent Node
Tests diagram generation logic using LLM mocks.
"""

import sys
import os
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.nodes.architect import architect_node

def test_architect_node_success():
    """Verify architect_node correctly prompts LLM and parses JSON response"""
    
    state = {
        "repo_url": "https://github.com/test/repo",
        "total_files": 10,
        "successfully_parsed": 9,
        "parsed_files": [
            {
                "path": "src/app.py",
                "language": "python",
                "chunks": ["class App:", "def run():"]
            }
        ]
    }

    mock_llm_output = {
        "nodes": [
            {"id": "app", "type": "default", "data": {"label": "App Component"}, "position": {"x": 0, "y": 0}},
            {"id": "db", "type": "default", "data": {"label": "Database"}, "position": {"x": 0, "y": 0}}
        ],
        "edges": [
            {"id": "e-app-db", "source": "app", "target": "db", "label": "uses"}
        ],
        "mermaid_syntax": "graph TD\n  app-->db"
    }

    # Create a mock chain
    mock_chain = MagicMock()
    mock_chain.invoke.return_value = mock_llm_output

    # Patch everything to return mock_chain
    with patch("app.agents.nodes.architect.get_diagram_llm"), \
         patch("app.agents.nodes.architect.ChatPromptTemplate.from_messages") as mock_prompt_factory, \
         patch("app.agents.nodes.architect.JsonOutputParser"):
        
        # Configure mock_prompt_factory to return an object that when piped returns mock_chain
        mock_prompt = MagicMock()
        mock_prompt.__or__.return_value = MagicMock(__or__=lambda s, other: mock_chain)
        mock_prompt_factory.return_value = mock_prompt
             
        result = architect_node(state)
        
        # Assertions
        assert result["current_step"] == "architecting_complete"
        assert len(result["reactflow_nodes"]) == 2
        assert "App Component" in str(result["reactflow_nodes"])
        print("✅ Architect node successfully generated diagram from mock")

def test_architect_node_confidence_medium():
    """Verify confidence is 'medium' when parsing success is moderate"""
    state = {
        "repo_url": "https://github.com/test/repo",
        "total_files": 10,
        "successfully_parsed": 6, 
        "parsed_files": [{"path": "a.py", "language": "python", "content": "...", "chunks": ["..."]}]
    }
    
    mock_chain = MagicMock()
    mock_chain.invoke.return_value = {"nodes": [], "edges": [], "mermaid_syntax": ""}
    
    with patch("app.agents.nodes.architect.get_diagram_llm"), \
         patch("app.agents.nodes.architect.ChatPromptTemplate.from_messages") as mock_prompt_factory, \
         patch("app.agents.nodes.architect.JsonOutputParser"):
        
        mock_prompt = MagicMock()
        mock_prompt.__or__.return_value = MagicMock(__or__=lambda s, other: mock_chain)
        mock_prompt_factory.return_value = mock_prompt
        
        result = architect_node(state)
        assert result["confidence_level"] == "medium"
        print("✅ Confidence level correctly calculated as 'medium'")

def test_architect_node_error_handling():
    """Verify architect_node handles LLM errors gracefully"""
    state = {
        "repo_url": "https://github.com/test/repo",
        "parsed_files": [{"path": "a.py", "language": "python", "content": "...", "chunks": ["..."]}]
    }
    
    with patch("app.agents.nodes.architect.get_diagram_llm", side_effect=Exception("LLM Timeout")):
        result = architect_node(state)
        assert result["current_step"] == "error"
        assert "LLM Timeout" in result["error"]
        print("✅ Architect node handles LLM errors gracefully")

if __name__ == "__main__":
    print("\n🧪 Running Step 6 Unit Tests: Architect Agent Node\n" + "=" * 55)
    test_architect_node_success()
    test_architect_node_confidence_medium()
    test_architect_node_error_handling()
    print("\n" + "=" * 55)
    print("✅ All 3 tests passed! Step 6 complete.\n")
