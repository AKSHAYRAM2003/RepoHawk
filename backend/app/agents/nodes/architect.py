"""
Step 6: Architect Agent Node
Generates a layered architecture diagram (AWS-style) using React Flow JSON.
"""

import json
import re
from typing import Dict, Any, List
from app.agents.state import AnalysisState, ParsedFile, ReactFlowNode, ReactFlowEdge
from app.core.llm import get_diagram_llm, _invoke_with_retry

SYSTEM_PROMPT = """
You are a Senior Staff Software Architect analyzing a codebase.
Produce an AWS-style layered architecture diagram in JSON.

VOCABULARY
- "layer": horizontal tier (e.g. Applications, Core Services, Data Storage)
- "group": named subsection within a layer (e.g. "API Gateway", "Workers")
- "type": semantic category — one of: app | service | package | agent | infrastructure | external | database

OUTPUT FORMAT — return ONLY valid JSON:
{
  "nodes": [
    {
      "id": "kebab-case-id",
      "data": {
        "label": "Human Name",
        "layer": "applications | core-services | business-logic | data-storage | external | dev-tools",
        "group": "Subgroup Name",
        "type": "app | service | package | agent | infrastructure | external | database",
        "description": "One-line what this does",
        "tech": "Key tech stack (e.g. FastAPI + SQLAlchemy)"
      }
    }
  ],
  "edges": [
    {
      "id": "e-source-target",
      "source": "source-node-id",
      "target": "target-node-id",
      "label": "verb label (e.g. calls, publishes, reads, triggers)",
      "relation": "data-flow | control-flow | build-dep"
    }
  ]
}

LAYERING RULES (top → bottom as rendered):
Layer "dev-tools"        — CI/CD, Docker, Makefile, linters
Layer "applications"     — web apps, CLIs, dashboards, mobile apps
Layer "core-services"    — API gateways, main entry points, daemons
Layer "business-logic"   — internal modules, agents, workers, skills
Layer "data-storage"     — databases, caches, queues, S3
Layer "external"         — Stripe, OpenAI, WebSocket, 3rd-party APIs

GROUPING RULES:
- Group related nodes under a shared group name within each layer
- Example: in "core-services" layer, group "API Layer" might contain "Auth Service" and "User Service"

NODE DESIGN GUIDELINES:
- Each node = one meaningful architectural component, NOT one file
- Combine related files into single nodes
- 1–2 sentence description explaining purpose

EDGE RULES — Only draw meaningful relationships:
1. "calls"        — runtime HTTP/gRPC call
2. "publishes"    — event/message published
3. "consumes"     — event/message consumed
4. "reads"        — reads from DB/cache
5. "writes"       — writes to DB/cache
6. "triggers"     — starts a workflow/daemon
7. "imports"      — build-time dependency
8. "deploys"      — CI/CD deploys to infra

No more than 20 nodes total.
No more than 25 edges total.
Prefer quality over quantity.
"""

USER_PROMPT_TEMPLATE = """
Analyze this codebase and produce an architecture diagram.

REPO: {repo_url}
FILES ANALYZED: {file_count}

STRUCTURE SUMMARY:
{structure_summary}

Output the JSON diagram following the rules above.
"""

def architect_node(state: Dict[str, Any]) -> Dict[str, Any]:
    repo_url = state.get("repo_url")
    parsed_files: List[ParsedFile] = state.get("parsed_files", [])

    if not parsed_files:
        return {"error": "No parsed files to architect", "current_step": "error"}

    summary_lines = []
    for pf in parsed_files:
        summary_lines.append(f"File: {pf['path']} ({pf['language']})")
        for chunk in pf["chunks"][:2]:
            clean_chunk = chunk.split("\n")[0].strip()
            summary_lines.append(f"  - {clean_chunk}")

    structure_summary = "\n".join(summary_lines[:200])

    try:
        llm = get_diagram_llm()
        # Build messages directly (avoid LangChain template parsing of JSON braces)
        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=USER_PROMPT_TEMPLATE.format(
                repo_url=repo_url,
                file_count=len(parsed_files),
                structure_summary=structure_summary
            ))
        ]

        response = _invoke_with_retry(llm, messages)

        nodes = response.get("nodes", [])
        edges = response.get("edges", [])

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
            "confidence_level": confidence,
            "current_step": "architecting_complete",
            "progress_log": [f"✅ Generated layered architecture with {len(nodes)} components across {len(set(n.get('data',{}).get('layer','') for n in nodes))} layers"]
        }

    except Exception as e:
        return {
            "error": f"Architecting failed: {str(e)}",
            "current_step": "error",
            "progress_log": [f"❌ Architecture generation failed: {str(e)}"]
        }
