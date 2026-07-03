"""
Step 7: Critique Agent Node
Validates the generated architecture diagram for accuracy and completeness.
Uses the strong reasoning GPT-OSS model via OpenRouter.

Input:  AnalysisState with reactflow_nodes, reactflow_edges, parsed_files
Output: AnalysisState with critique_passed, critique_feedback, retry_count
"""

import json
from typing import Dict, Any, List
from app.agents.state import AnalysisState
from app.core.llm import get_critique_llm, _invoke_with_retry

# Maximum number of critique passes before we give up and ship the best-effort
# diagram. `retry_count` is incremented once per critique run, so a value of 3
# allows the initial diagram + up to 2 regenerations. The graph's retry edge
# imports this same constant to keep the loop bound and the messaging in sync.
MAX_CRITIQUE_ATTEMPTS = 3

SYSTEM_PROMPT = """
You are a Quality Assurance Architect. Critique an architecture diagram.

You will receive:
1. A summary of the actual files in the codebase.
2. The generated React Flow diagram (nodes and edges).

### Your Task:
Check if the diagram is accurate and representative of the codebase.

CRITICAL: Diagram nodes are ARCHITECTURAL ABSTRACTIONS, not file names. 
Example: A node called "Routing Engine" is CORRECT even if no file is literally named "routing_engine.py" — it represents the routing system composed of files like router.py, views.py, urls.py.

Diagram labels are high-level concepts, not file names. DO NOT fail the diagram because node labels don't match file names.

### Output Format:
You MUST return ONLY a JSON object with this exact structure:
{ "critique_passed": true/false, "critique_feedback": "One-sentence explanation." }

PASS if:
- The diagram covers the main architectural concerns of the codebase
- Nodes represent real subsystems present in the code (even if abstracted/named differently)
- Edges make logical sense based on how subsystems interact

FAIL ONLY if:
- There are ZERO nodes in the diagram
- The diagram describes a completely different codebase
- Multiple nodes are pure hallucinations with no basis in the code

Be VERY lenient. Architectural diagrams are high-level summaries, not file maps.
"""

USER_PROMPT_TEMPLATE = """
ACTUAL CODEBASE STRUCTURE:
{structure_summary}

GENERATED DIAGRAM NODES:
{nodes}

GENERATED DIAGRAM EDGES:
{edges}
"""

def critique_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Critiques the architecture diagram.
    """
    nodes = state.get("reactflow_nodes", [])
    edges = state.get("reactflow_edges", [])
    parsed_files = state.get("parsed_files", []) or []
    retry_count = state.get("retry_count") or 0

    # 1. Prepare structure summary for the critique
    summary_lines = []
    for pf in parsed_files:
        summary_lines.append(f"- {pf['path']} ({pf['language']})")
    structure_summary = "\n".join(summary_lines[:100])

    try:
        # 2. Setup LLM and messages (direct, no template engine)
        llm = get_critique_llm()
        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=USER_PROMPT_TEMPLATE.format(
                structure_summary=structure_summary,
                nodes=json.dumps(nodes),
                edges=json.dumps(edges)
            ))
        ]

        # 3. Invoke LLM with auto-retry on rate limits
        response = _invoke_with_retry(llm, messages)

        passed = response.get("critique_passed", False)
        feedback = response.get("critique_feedback", "No feedback provided.")

        attempt = retry_count + 1

        # Build a progress log that reflects what will actually happen next so
        # the UI messaging matches the graph's retry decision.
        if passed:
            log = f"✅ Critique passed (attempt {attempt}): {feedback}"
        elif attempt >= MAX_CRITIQUE_ATTEMPTS:
            log = (
                f"⚠️ Critique failed on final attempt {attempt} — shipping best-effort "
                f"diagram: {feedback}"
            )
        else:
            log = f"🔄 Critique failed (attempt {attempt}) — regenerating diagram: {feedback}"

        return {
            "critique_passed": passed,
            "critique_feedback": feedback,
            "retry_count": attempt,
            "current_step": "critique_complete",
            "progress_log": [log],
        }

    except Exception as e:
        # Fail OPEN: if the critique step errors technically (rate limit, bad JSON,
        # model unavailable), we accept the current diagram rather than blocking the
        # whole pipeline. critique_passed=True so the graph ends here. The feedback
        # text is phrased consistently with a pass so it never contradicts the flag.
        return {
            "critique_passed": True,
            "critique_feedback": (
                "Critique skipped due to a technical error; the diagram was accepted "
                f"without review. Details: {str(e)}"
            ),
            "retry_count": (retry_count or 0) + 1,
            "current_step": "critique_complete",
            "progress_log": [
                f"⚠️ Critique agent technical error — accepting diagram without review: {str(e)}"
            ],
        }
