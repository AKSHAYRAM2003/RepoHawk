"""
Step 8: LangGraph Orchestrator
Wires all agent nodes into a state machine graph.
Handles the flow from cloning to final diagram validation.
"""

from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END
from app.agents.state import AnalysisState
from app.agents.nodes.git_cloner import git_cloner_node
from app.agents.nodes.ast_parser import ast_parser_node
from app.agents.nodes.embedder import embedder_node
from app.agents.nodes.architect import architect_node
from app.agents.nodes.critique import critique_node

def should_continue_after_critique(state: AnalysisState) -> Literal["architect", "end"]:
    """
    Conditional edge: Decides whether to retry diagram generation or finish.
    """
    if state.get("critique_passed", False):
        return "end"
    
    if state.get("retry_count", 0) >= 3:
        # Stop after 3 retries even if it failed
        return "end"
    
    return "architect"

def create_analysis_graph():
    """
    Creates and compiles the LangGraph state machine for repo analysis.
    """
    # 1. Initialize Graph with state
    workflow = StateGraph(AnalysisState)

    # 2. Add Nodes
    workflow.add_node("git_cloner", git_cloner_node)
    workflow.add_node("ast_parser", ast_parser_node)
    workflow.add_node("embedder", embedder_node)
    workflow.add_node("architect", architect_node)
    workflow.add_node("critique", critique_node)

    # 3. Add Edges (linear flow)
    workflow.set_entry_point("git_cloner")
    workflow.add_edge("git_cloner", "ast_parser")
    workflow.add_edge("ast_parser", "embedder")
    workflow.add_edge("embedder", "architect")
    workflow.add_edge("architect", "critique")

    # 4. Add Conditional Edge (Retry Loop)
    workflow.add_conditional_edges(
        "critique",
        should_continue_after_critique,
        {
            "architect": "architect",
            "end": END
        }
    )

    # 5. Compile
    return workflow.compile()

# Singleton instance of the analysis graph
analysis_graph = create_analysis_graph()
