"""
RepoHawk Agent State Definition
Defines the typed state that flows through the entire LangGraph pipeline.

Two separate states:
  - AnalysisState: for the repo analysis pipeline (clone → parse → embed → diagram → critique)
  - QAState: for the RAG Q&A pipeline (question → retrieve → answer)
"""

from typing import TypedDict, List, Optional, Annotated
from langchain_core.messages import BaseMessage
import operator


# --- Sub-types ---

class ParsedFile(TypedDict):
    """Represents a single file after AST parsing"""
    path: str                    # e.g. "src/auth/service.py"
    language: str                # e.g. "python", "typescript", "go"
    content: str                 # Raw file content (for display in CodeSidePanel)
    chunks: List[str]            # Semantic chunks from tree-sitter parsing


class ReactFlowNode(TypedDict, total=False):
    """A single node in the React Flow diagram"""
    id: str                      # Unique node ID
    type: str                    # "default", "module", "function" etc.
    position: dict               # {"x": 0, "y": 0} — auto-layout fills this
    data: dict                   # {"label": "AuthService", "files": [...]}


class ReactFlowEdge(TypedDict, total=False):
    """A single edge (connection) in the React Flow diagram"""
    id: str
    source: str                  # Source node ID
    target: str                  # Target node ID
    label: Optional[str]         # e.g. "imports", "calls"
    animated: bool


class CodeRef(TypedDict, total=False):
    """Reference to a specific code location — used to highlight in frontend"""
    file: str
    line_start: int
    line_end: int


# --- Pipeline States ---

class AnalysisState(TypedDict, total=False):
    """
    State for the analysis pipeline: GitHub URL → Architecture Diagram.
    Flows through: GitCloner → ASTParser → Embedder → Architect → Critique
    """
    # Input
    repo_url: str
    repo_id: str                              # UUID from Postgres

    # Step 3: Git Cloner
    cloned_path: str                          # /tmp/repohawk/{repo_id}/

    # Step 4: AST Parser
    parsed_files: List[ParsedFile]
    total_files: int
    successfully_parsed: int

    # Step 5: Embedder
    embeddings_stored: bool

    # Step 6: Architect Agent
    mermaid_syntax: str                       # Raw Mermaid from LLM
    reactflow_nodes: List[ReactFlowNode]      # Converted for frontend
    reactflow_edges: List[ReactFlowEdge]      # Converted for frontend

    # Step 6: Confidence
    confidence_level: str                     # "high" | "medium" | "low"
    confidence_file_count: int

    # Step 7: Critique Agent
    critique_passed: bool
    critique_feedback: str
    retry_count: int                          # Max 3

    # Output
    diagram_id: str                           # UUID saved in Postgres

    # SSE Progress
    current_step: str                         # "cloning", "parsing", "embedding", etc.
    progress_log: Annotated[List[str], operator.add]  # Append-only log

    # Error handling
    error: str


class QAState(TypedDict, total=False):
    """
    State for the Q&A RAG pipeline: User Question → Answer + Highlights.
    Separate from AnalysisState because it runs independently after analysis.
    """
    # Input
    repo_id: str
    session_id: str                           # Chat session UUID
    question: str
    valid_node_ids: List[str]                 # Real diagram node IDs (for highlight validation)

    # Memory (LangGraph auto-merges via operator.add)
    chat_history: Annotated[List[BaseMessage], operator.add]

    # RAG retrieval
    retrieved_chunks: List[str]               # Top-K from ChromaDB (after relevance filter)
    rewritten_question: str                    # After query rewriting (for telemetry/debug)

    # Output
    answer: str
    highlight_node_id: str                    # React Flow node to highlight (validated)
    code_ref: CodeRef                         # File + line range
    source_files: List[str]                   # Files that contributed to the answer

    # Error handling
    error: str

