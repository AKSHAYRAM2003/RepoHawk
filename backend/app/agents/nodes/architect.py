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
You are a Senior Staff Software Architect producing a production-grade AWS-style architecture diagram.

VOCABULARY
- "layer": horizontal tier (top to bottom rendering order)
- "group": named subsection within a layer
- "type": semantic category

LAYERS (top → bottom):
  "dev-tools"        — CI/CD, Docker, Makefile, linters, package managers
  "applications"     — web apps, CLIs, dashboards, mobile frontends
  "core-services"    — API gateways, entry point servers, main daemons, routers
  "business-logic"   — internal modules, agents, workers, skills, processors
  "data-storage"     — databases, caches, queues, blob storage, vector stores
  "external"         — Stripe, OpenAI, GitHub API, WebSocket, 3rd-party services

NODE TYPES (pick the most accurate):
  "app"              → frontend application, CLI, dashboard
  "service"          → backend service, API, daemon, server
  "package"          → shared library, SDK, utility package
  "agent"            → ML agent, coding agent, orchestration module, skill
  "infrastructure"   → Docker, K8s, CI/CD, monitoring, build tool
  "external"         → 3rd party API, SaaS, payment system
  "database"         → PostgreSQL, Redis, MongoDB, S3, vector DB, queue

RULES:
1. Each node = one meaningful architectural component, NOT one file
2. Combine related files into single nodes (max 20 nodes total)
3. Descriptions must be meaningful: explain what the component DOES (1-2 sentences)
4. Tech field: short stack (e.g. "FastAPI + SQLAlchemy", "Next.js 14", "Redis 7")
5. Labels: short human-readable names (e.g. "API Gateway", "Auth Service", "Web App")
6. group: optional, used to visually cluster nodes within same layer

EDGES — only draw runtime/meaningful relationships (max 25 edges):
  Relation types: "data-flow" | "control-flow" | "build-dep"
  Labels: short verbs: "calls", "publishes", "consumes", "reads", "writes",
          "triggers", "deploys", "streams to", "authenticates", "fetches"

  - "data-flow": real-time data or event streaming (animated in UI)
  - "control-flow": orchestration, triggers, API calls
  - "build-dep": compile-time / package dependency (dashed in UI)

DO NOT draw: file imports, every internal module connection, circular noise

OUTPUT FORMAT — return ONLY valid JSON with no markdown fences:
{
  "nodes": [
    {
      "id": "kebab-case-unique-id",
      "data": {
        "label": "Human Readable Name",
        "layer": "<layer from list above>",
        "group": "Optional Group Name",
        "type": "<type from list above>",
        "description": "What this component does in 1-2 sentences.",
        "tech": "Primary tech stack"
      }
    }
  ],
  "edges": [
    {
      "id": "e-source-target",
      "source": "source-node-id",
      "target": "target-node-id",
      "label": "verb label",
      "relation": "data-flow | control-flow | build-dep"
    }
  ]
}

Quality over quantity. Prefer whitespace over compactness. Think like an AWS Solutions Architect.
"""

USER_PROMPT_TEMPLATE = """
Analyze this codebase and produce a clean, production-grade architecture diagram.

REPO: {repo_url}
FILES ANALYZED: {file_count}

STRUCTURE SUMMARY (first 2 snippets per file):
{structure_summary}
{critique_block}
Infer the actual architecture from these files. Output the JSON diagram only.
"""

# Injected into the prompt only when regenerating after a failed critique.
CRITIQUE_FEEDBACK_TEMPLATE = """
A previous attempt at this diagram was REJECTED by a QA reviewer. You MUST fix
the issues below in this new attempt:

REVIEWER FEEDBACK:
{critique_feedback}
"""

def architect_node(state: Dict[str, Any]) -> Dict[str, Any]:
    repo_url = state.get("repo_url")
    parsed_files: List[ParsedFile] = state.get("parsed_files", [])

    if not parsed_files:
        return {"error": "No parsed files to architect", "current_step": "error"}

    # On a retry (critique failed previously), feed the reviewer's feedback back
    # into the prompt so the regeneration actually addresses the problems.
    retry_count = state.get("retry_count", 0) or 0
    critique_feedback = state.get("critique_feedback", "") or ""
    if retry_count > 0 and critique_feedback:
        critique_block = CRITIQUE_FEEDBACK_TEMPLATE.format(critique_feedback=critique_feedback)
    else:
        critique_block = ""

    summary_lines = []
    for pf in parsed_files:
        summary_lines.append(f"File: {pf['path']} ({pf['language']})")
        for chunk in pf["chunks"][:2]:
            clean_chunk = chunk.split("\n")[0].strip()
            summary_lines.append(f"  - {clean_chunk}")

    structure_summary = "\n".join(summary_lines[:250])

    try:
        llm = get_diagram_llm()
        # Build messages directly (avoid LangChain template parsing of JSON braces)
        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=USER_PROMPT_TEMPLATE.format(
                repo_url=repo_url,
                file_count=len(parsed_files),
                structure_summary=structure_summary,
                critique_block=critique_block,
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

        layer_set = set(n.get('data', {}).get('layer', '') for n in nodes)
        return {
            "reactflow_nodes": nodes,
            "reactflow_edges": edges,
            "confidence_level": confidence,
            "current_step": "architecting_complete",
            "progress_log": [
                f"✅ Generated AWS-style architecture: {len(nodes)} components across {len(layer_set)} layers, {len(edges)} relationships"
            ]
        }

    except Exception as e:
        return {
            "error": f"Architecting failed: {str(e)}",
            "current_step": "error",
            "progress_log": [f"❌ Architecture generation failed: {str(e)}"]
        }
