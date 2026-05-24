"""
Step 6: Architect Agent Node
Generates a React Flow diagram structure (nodes and edges) from the parsed codebase.
Uses the code-specialized Qwen3 Coder model via OpenRouter.

Input:  AnalysisState with parsed_files, repo_id
Output: AnalysisState with mermaid_syntax, reactflow_nodes, reactflow_edges, 
        confidence_level, current_step, progress_log
"""

import json
import re
from typing import Dict, Any, List
from app.agents.state import AnalysisState, ParsedFile, ReactFlowNode, ReactFlowEdge
from app.core.llm import get_diagram_llm, _invoke_with_retry
from langchain_core.prompts import ChatPromptTemplate

SYSTEM_PROMPT = """
You are a Senior Software Architect. Your task is to analyze a codebase's structure and generate a high-level architecture diagram in JSON format compatible with React Flow.

You will be provided with a summary of files, their classes, functions, and key imports.

### Instructions:
1. Identify the core components/modules of the application.
2. Group files into logical boxes (nodes) where appropriate.
3. Create nodes for major classes or functions if they are central to the architecture.
4. Draw edges (connections) between nodes to show dependencies, data flow, or function calls.
5. Use consistent naming.

### Output Format:
You MUST return ONLY a JSON object with this exact structure:
{{
  "nodes": [
    {{
      "id": "unique-id",
      "type": "default",
      "data": {{ "label": "Component Name", "description": "brief desc" }},
      "position": {{ "x": 0, "y": 0 }}
    }}
  ],
  "edges": [
    {{
      "id": "e-source-target",
      "source": "source-id",
      "target": "target-id",
      "label": "dependency type"
    }}
  ],
  "mermaid_syntax": "graph TD\\n  A-->B"
}}

Position 'x' and 'y' should be 0; the frontend will handle auto-layout.
Keep 'id' values concise and descriptive (e.g., "auth-service", "user-db").
"""

USER_PROMPT_TEMPLATE = """
Analyze the following codebase structure and generate the architecture diagram.

REPO: {repo_url}
FILES ANALYZED: {file_count}

STRUCTURE SUMMARY:
{structure_summary}
"""

def architect_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Generates the architecture diagram using Qwen3 Coder.
    """
    repo_url = state.get("repo_url")
    parsed_files: List[ParsedFile] = state.get("parsed_files", [])
    
    if not parsed_files:
        return {
            "error": "No parsed files to architect",
            "current_step": "error"
        }

    # 1. Build Structure Summary for Prompt
    summary_lines = []
    for pf in parsed_files:
        summary_lines.append(f"File: {pf['path']} ({pf['language']})")
        # Just use the first few chunks or a focused summary to save tokens
        # Typically chunks[0] in our AST parser includes imports/class headers
        for chunk in pf["chunks"][:2]: 
            # Clean up chunk to be a one-liner signature/header
            clean_chunk = chunk.split("\n")[0].strip()
            summary_lines.append(f"  - {clean_chunk}")
    
    structure_summary = "\n".join(summary_lines[:200]) # Cap summary to avoid context blowup

    try:
        # 2. Setup LLM and Prompt
        llm = get_diagram_llm()
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("user", USER_PROMPT_TEMPLATE)
        ])

        # 3. Invoke LLM with auto-retry on rate limits
        response = _invoke_with_retry(llm, prompt, {
            "repo_url": repo_url,
            "file_count": len(parsed_files),
            "structure_summary": structure_summary
        })

        # 4. Extract and Validate response
        nodes = response.get("nodes", [])
        edges = response.get("edges", [])
        mermaid = response.get("mermaid_syntax", "")

        # 5. Calculate Confidence
        # Simple heuristic: successfully parsed files vs total files ratio
        success_ratio = state.get("successfully_parsed", 0) / state.get("total_files", 1)
        if success_ratio > 0.8:
            confidence = "high"
        elif success_ratio > 0.5:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "reactflow_nodes": nodes,
            "reactflow_edges": edges,
            "mermaid_syntax": mermaid,
            "confidence_level": confidence,
            "confidence_file_count": state.get("successfully_parsed", 0),
            "current_step": "architecting_complete",
            "progress_log": [f"✅ Generated architecture diagram with {len(nodes)} nodes and {len(edges)} connections (Confidence: {confidence})"]
        }

    except Exception as e:
        return {
            "error": f"Architecting failed: {str(e)}",
            "current_step": "error",
            "progress_log": [f"❌ Architecture generation failed: {str(e)}"]
        }
