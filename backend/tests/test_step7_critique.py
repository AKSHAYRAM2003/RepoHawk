"""
Unit Tests for Step 7: Critique Agent Node
Tests diagram validation logic using LLM mocks.
"""

import sys
import os
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.nodes.critique import critique_node

def test_critique_node_pass():
    """Verify critique_node handles a 'pass' response from the LLM"""
    state = {
        "reactflow_nodes": [{"id": "a"}],
        "reactflow_edges": [],
        "parsed_files": [{"path": "a.py", "language": "python"}],
        "retry_count": 0
    }

    mock_llm_output = {
        "critique_passed": True,
        "critique_feedback": "Looks solid."
    }

    mock_chain = MagicMock()
    mock_chain.invoke.return_value = mock_llm_output

    with patch("app.agents.nodes.critique.get_critique_llm"), \
         patch("app.agents.nodes.critique.ChatPromptTemplate.from_messages") as mock_prompt_factory, \
         patch("app.agents.nodes.critique.JsonOutputParser"):
        
        mock_prompt = MagicMock()
        mock_prompt.__or__.return_value = MagicMock(__or__=lambda s, other: mock_chain)
        mock_prompt_factory.return_value = mock_prompt
             
        result = critique_node(state)
        
        assert result["critique_passed"] is True
        assert result["retry_count"] == 1
        assert "✅" in result["progress_log"][0]
        print("✅ Critique node successfully handled pass response")

def test_critique_node_fail():
    """Verify critique_node handles a 'fail' response from the LLM"""
    state = {
        "reactflow_nodes": [],
        "reactflow_edges": [],
        "parsed_files": [{"path": "core.py", "language": "python"}],
        "retry_count": 1
    }

    mock_llm_output = {
        "critique_passed": False,
        "critique_feedback": "Major components missing."
    }

    mock_chain = MagicMock()
    mock_chain.invoke.return_value = mock_llm_output

    with patch("app.agents.nodes.critique.get_critique_llm"), \
         patch("app.agents.nodes.critique.ChatPromptTemplate.from_messages") as mock_prompt_factory, \
         patch("app.agents.nodes.critique.JsonOutputParser"):
        
        mock_prompt = MagicMock()
        mock_prompt.__or__.return_value = MagicMock(__or__=lambda s, other: mock_chain)
        mock_prompt_factory.return_value = mock_prompt
             
        result = critique_node(state)
        
        assert result["critique_passed"] is False
        assert result["retry_count"] == 2
        assert "⚠️" in result["progress_log"][0]
        print("✅ Critique node successfully handled fail response")

if __name__ == "__main__":
    print("\n🧪 Running Step 7 Unit Tests: Critique Agent Node\n" + "=" * 55)
    test_critique_node_pass()
    test_critique_node_fail()
    print("\n" + "=" * 55)
    print("✅ All 2 tests passed! Step 7 complete.\n")
