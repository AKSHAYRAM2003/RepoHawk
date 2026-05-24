"""
LangGraph Orchestration
Wires all agent nodes into state machine graphs for analysis and Q&A.
"""

from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END

from app.agents.state import AnalysisState, QAState
from app.agents.nodes.git_cloner import git_cloner_node
from app.agents.nodes.ast_parser import ast_parser_node
from app.agents.nodes.embedder import embedder_node
from app.agents.nodes.architect import architect_node
from app.agents.nodes.critique import critique_node
from app.agents.nodes.qa_agent import qa_agent_node

# --- Analysis Pipeline Logic ---

def should_continue_after_critique(state: AnalysisState) -> Literal["architect", "end"]:
    """
    Conditional edge: Decides whether to retry diagram generation or finish.
    """
    if state.get("critique_passed", False):
        return "end"
    
    if state.get("retry_count", 0) >= 1:
        # Stop after 3 retries even if it failed
        return "end"
    
    return "architect"

def create_analysis_graph():
    """
    Creates and compiles the LangGraph state machine for repo analysis.
    """
    workflow = StateGraph(AnalysisState)

    workflow.add_node("git_cloner", git_cloner_node)
    workflow.add_node("ast_parser", ast_parser_node)
    workflow.add_node("embedder", embedder_node)
    workflow.add_node("architect", architect_node)
    workflow.add_node("critique", critique_node)

    workflow.set_entry_point("git_cloner")
    workflow.add_edge("git_cloner", "ast_parser")
    workflow.add_edge("ast_parser", "embedder")
    workflow.add_edge("embedder", "architect")
    workflow.add_edge("architect", "critique")

    workflow.add_conditional_edges(
        "critique",
        should_continue_after_critique,
        {
            "architect": "architect",
            "end": END
        }
    )

    return workflow.compile()


# --- QA Pipeline Logic ---

def create_qa_graph():
    """
    Creates the LangGraph state machine for the Q&A agent.
    Single-node graph for now, but expandable for multi-hop RAG.
    """
    workflow = StateGraph(QAState)
    workflow.add_node("qa_agent", qa_agent_node)
    workflow.set_entry_point("qa_agent")
    workflow.add_edge("qa_agent", END)
    return workflow.compile()


# --- Singleton Instances ---

analysis_graph = create_analysis_graph()
qa_graph = create_qa_graph()
