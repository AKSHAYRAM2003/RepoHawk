# Repo Hawk — Complete App Context
> AI-assisted code editor context file. Feed this to Claude Code, Cursor, Windsurf, or GitHub Copilot for full project awareness.
> Last updated: April 2026 · Version: MVP

---

## 1. What is Repo Hawk?

Repo Hawk is an **Agentic AI Visual Documentation Generator** — a web application where a developer pastes any public GitHub repository URL and receives:

- An interactive, zoomable **architecture diagram** of the entire codebase
- A **function-level flowchart** for any module or function on demand
- A **natural language Q&A interface** that answers questions about the codebase and highlights relevant diagram nodes
- A **Git staleness detector** that flags which diagrams are outdated after each commit
- A **shareable public doc page** (public URL, embeddable in READMEs)
- A **REPOHAWK.md export** — a structured markdown file dropped into cloned repos so AI copilots gain instant codebase context

**Target users:** Software developers (1–5 yrs experience), tech leads, OSS maintainers, new team joiners.

**Core value proposition:** Understand any codebase in seconds. Make every AI coding assistant 10x smarter about your specific repo — automatically.

---

## 2. App Name & Branding

- **Product name:** Repo Hawk
- **Tagline:** *"See every codebase from above."*
- **CLI command prefix:** `repohawk` (e.g. `repohawk init`, `repohawk update`)
- **Export file name:** `REPOHAWK.md` (written to project root)
- **Design aesthetic:** Dark-first, minimal chrome, high-density information. Fonts: Syne (display) + DM Mono (code). Accent: `#1A6BFF` blue primary, `#0F9D6B` green success, `#D48A0F` amber warning.

---

## 3. Full Feature List

### F-01 · Repo-to-Architecture Diagram
**What it does:** User pastes a GitHub URL → AI agent clones repo, parses all files via AST, builds a vector index, generates an interactive Mermaid.js architecture diagram showing all modules, their relationships, and data flows.

**User benefit:** Understand a new codebase in 60 seconds instead of 3 days.

**Implementation notes:**
- LangGraph orchestrates the multi-step agent pipeline
- AST parsing via `tree-sitter` (Python, JS, TS, Go supported in MVP)
- Embeddings stored in ChromaDB for semantic retrieval
- Diagram output: Mermaid.js syntax, rendered on frontend with D3-zoom
- Confidence score calculated as `(files_successfully_parsed / total_files) * weight_by_size`

---

### F-02 · Function-Level Flow Visualizer
**What it does:** User clicks any node in the architecture diagram → system generates a zoomed-in flowchart of that specific function/module: inputs, outputs, decision branches, external calls.

**User benefit:** Trace what a function actually does without reading raw code.

**Implementation notes:**
- Triggered on node click event from DiagramCanvas component
- Sub-agent queries ChromaDB for that module's embeddings + calls GPT-4.1-mini with function body
- Renders as a second Mermaid diagram in a slide-over panel
- Cached per function hash — regenerated only if file changes

---

### F-03 · Natural Language Q&A
**What it does:** User types any question about the repo ("where is auth handled?", "which service calls payments?") → system answers in plain English AND highlights the relevant node in the diagram simultaneously.

**User benefit:** Daily-use feature. Replaces copy-pasting code into ChatGPT.

**Implementation notes:**
- RAG pipeline: query → embedding → ChromaDB semantic search → top-k chunks → GPT-4.1-mini → answer + node ID
- Frontend receives `{ answer: string, highlight_node_id: string, code_ref: { file, line_start, line_end } }`
- Diagram canvas listens for `highlight_node_id` and applies highlight class
- Suggested questions auto-generated on first repo load based on module names

---

### F-04 · Git Staleness Detector
**What it does:** After any commit, Repo Hawk flags which diagrams are potentially outdated based on which files changed. Shows a `⚠ 2 files changed` badge on affected diagrams. Does NOT auto-rewrite — flags for human review.

**User benefit:** Documentation never silently rots. Devs know exactly what to re-verify.

**Implementation notes:**
- Git hook (`post-commit`) or periodic polling via GitPython
- Diff analysis: changed files → map to diagram nodes via the stored file→node index
- Staleness stored as `{ diagram_id, stale_reason, changed_files[], commit_sha }`
- Badge shown on dashboard diagram list and inside DiagramCanvas top-right

---

### F-05 · Shareable Public Doc Page
**What it does:** Every analyzed repo gets a permanent public URL (`repohawk.app/docs/{owner}/{repo}`). Anyone can view the diagrams and explore — no login required. Maintainers embed in README, teams send to new joiners.

**User benefit:** Replace 40-page onboarding docs. Viral growth loop baked in.

**Implementation notes:**
- Read-only version of DiagramCanvas (no edit/regenerate actions)
- `og:image` meta tag: auto-generated screenshot of architecture diagram (Puppeteer headless)
- Embed snippet: `<iframe src="repohawk.app/embed/{id}" />` for README use
- "Outdated? Regenerate →" CTA deep-links owner back to their dashboard

---

### F-06 · Confidence Score
**What it does:** Every generated diagram shows a badge: "High · 18 files" or "Medium · 6 files". Clicking it lists which files contributed to the diagram. Color-coded green/amber/red.

**User benefit:** Developers trust AI output when they can verify its basis. Prevents experienced engineers dismissing the output.

**Implementation notes:**
- `confidence_level`: `high` (>80% files parsed), `medium` (50–80%), `low` (<50%)
- Stored per diagram in DB alongside contributing file list
- ConfidenceBadge component: pill with color + count. Click → popover with file list.

---

### F-07 · REPOHAWK.md Copilot Context Export ⭐ (Differentiator)
**What it does:** Generates a structured `REPOHAWK.md` file and writes it to the project root when a developer runs `repohawk init` or uses the VS Code extension. This file is automatically picked up by Claude Code, Cursor, Windsurf, and GitHub Copilot as workspace context — making every AI assistant instantly smarter about that specific codebase.

**User benefit:** Every AI tool the developer already uses becomes aware of the codebase architecture without any extra effort.

**File structure of REPOHAWK.md export:**
```markdown
# Codebase Architecture — {repo_name}
Generated by Repo Hawk · {timestamp} · Confidence: {level}

## System overview
{2-3 sentence plain English summary}

## Architecture map
{text-based module relationship map}

## Entry points
- `{file}` — {one-line description}

## Module index
| Module | Responsibility |
|--------|---------------|
| `{path}/` | {description} |

## Key data flows
1. {flow description}

## AI context hints
- {architectural decisions, gotchas, intentional separations}
- {extracted from comments, ADRs, PR descriptions, commit messages}

## Repo Hawk full docs
Interactive diagrams: https://repohawk.app/docs/{owner}/{repo}
```

**Implementation notes:**
- CLI: `repohawk init` — one command, triggers full analysis, writes REPOHAWK.md
- VS Code extension: detects workspace open without REPOHAWK.md, shows notification
- Git hook: `post-commit` calls `repohawk update` for incremental regeneration
- AI context hints extracted by a dedicated sub-agent that reads: inline comments, ADR files, PR descriptions via GitHub API, commit messages
- The REPOHAWK.md URL back-links to the full interactive web app

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    REPO HAWK FRONTEND                    │
│  Next.js App Router · Tailwind CSS · React Query · D3    │
│                                                          │
│  Landing → Analysis → Dashboard → DiagramViewer → Chat  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST + SSE
┌───────────────────────▼─────────────────────────────────┐
│                    REPO HAWK BACKEND                     │
│              FastAPI (Python) · LangGraph                │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              ORCHESTRATOR AGENT                  │    │
│  │  Manages workflow, delegates to sub-agents       │    │
│  └──────┬──────────┬──────────┬──────────┬─────────┘    │
│         │          │          │          │               │
│  ┌──────▼──┐ ┌─────▼───┐ ┌───▼────┐ ┌───▼──────┐       │
│  │Codebase │ │Generative│ │Git     │ │Critique  │       │
│  │Analysis │ │Visual   │ │Update  │ │Agent     │       │
│  │Agent    │ │Agent    │ │Agent   │ │          │       │
│  └──────┬──┘ └─────┬───┘ └───┬────┘ └──────────┘       │
│         │          │          │                          │
│  ┌──────▼──────────▼──────────▼─────────────────────┐   │
│  │  ChromaDB (vector store) · PostgreSQL (metadata)  │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              CLI + VS CODE EXTENSION                     │
│  repohawk init · repohawk update · post-commit hook      │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend framework | Next.js (App Router) | Fullstack architecture, fast layout routing, React ecosystem |
| Styling | Tailwind CSS | Rapid utility-first styling |
| State / data fetching | React Query (TanStack) | Server state, caching, background refetch |
| Diagram rendering | Mermaid.js | LLMs generate Mermaid natively, wide ecosystem |
| Diagram interaction | D3-zoom | Pinch/scroll zoom on Mermaid SVG output |
| Backend framework | FastAPI (Python) | Async, fast, native Pydantic, easy LangGraph integration |
| Agent framework | LangGraph | Stateful multi-agent workflows, reflection loops |
| LLM | Nvidia NIM / OpenRouter | Strong code reasoning, cost-effective for MVP |
| Vector database | ChromaDB | Local-first, easy setup, semantic code search |
| Relational DB | PostgreSQL | Repo metadata, diagram records, user sessions |
| AST parsing | tree-sitter | Language-agnostic, fast, accurate |
| Git integration | GitPython | Repo cloning, diff analysis, hook management |
| Streaming | Server-Sent Events (SSE) | Agent log streaming from FastAPI to frontend |
| Screenshot generation | Puppeteer (headless) | og:image generation for share pages |
| CLI | Python + Click | `repohawk init`, `repohawk update` commands |
| VS Code extension | VS Code Extension API + Webview | Workspace detection, sidebar diagram panel |

---

## 6. Project Folder Structure

```
repohawk/
├── frontend/                        # Next.js app
│   ├── src/
│   │   ├── components/
│   │   │   ├── RepoInput/           # Hero URL bar, validation, history
│   │   │   ├── AgentLog/            # SSE streaming step feed
│   │   │   ├── DiagramCanvas/       # D3-zoom + Mermaid renderer
│   │   │   ├── CodeSidePanel/       # Slide-over: file + snippet on node click
│   │   │   ├── ConfidenceBadge/     # Pill: High/Medium/Low + file count
│   │   │   ├── ChatPanel/           # Q&A slide-over, message history
│   │   │   ├── StalenessTag/        # ⚠ badge on outdated diagrams
│   │   │   └── SharePage/           # Public read-only diagram view
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Analysis.jsx         # Progress screen with AgentLog
│   │   │   ├── Dashboard.jsx        # Repo home: stats + diagram list
│   │   │   ├── DiagramView.jsx      # Full canvas + code panel
│   │   │   ├── Chat.jsx             # Split panel: diagram + Q&A
│   │   │   └── Share.jsx            # Public doc page
│   │   ├── hooks/
│   │   │   ├── useSSE.js            # SSE connection for AgentLog
│   │   │   ├── useRepo.js           # React Query: repo data
│   │   │   └── useDiagram.js        # React Query: diagram fetch + highlight
│   │   ├── lib/
│   │   │   ├── api.js               # Axios instance + all API calls
│   │   │   └── mermaid.js           # Mermaid init + render helpers
│   │   └── main.jsx
│   └── package.json
│
├── backend/                         # FastAPI app
│   ├── app/
│   │   ├── main.py                  # FastAPI app init, CORS, routers
│   │   ├── routers/
│   │   │   ├── repos.py             # POST /repos/analyze, GET /repos/{id}
│   │   │   ├── diagrams.py          # GET /diagrams/{id}, POST /diagrams/query
│   │   │   ├── chat.py              # POST /chat/query
│   │   │   ├── share.py             # GET /share/{owner}/{repo}
│   │   │   └── export.py            # POST /export/repohawk-md
│   │   ├── agents/
│   │   │   ├── orchestrator.py      # LangGraph main graph definition
│   │   │   ├── codebase_agent.py    # Clone, parse AST, build embeddings
│   │   │   ├── visual_agent.py      # Generate Mermaid diagram syntax
│   │   │   ├── git_agent.py         # Diff analysis, staleness detection
│   │   │   ├── critique_agent.py    # Quality review of generated diagrams
│   │   │   └── context_agent.py     # Extract AI hints for REPOHAWK.md
│   │   ├── services/
│   │   │   ├── github.py            # GitHub API calls (star count, metadata)
│   │   │   ├── chromadb.py          # Vector store operations
│   │   │   ├── postgres.py          # DB session, CRUD helpers
│   │   │   ├── ast_parser.py        # tree-sitter parsing per language
│   │   │   ├── mermaid_generator.py # LLM prompt → Mermaid syntax
│   │   │   └── screenshot.py        # Puppeteer og:image generation
│   │   ├── models/
│   │   │   ├── repo.py              # Repo SQLAlchemy model
│   │   │   ├── diagram.py           # Diagram model + confidence fields
│   │   │   └── chat.py              # Chat message model
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   └── config.py                # Settings from env vars
│   ├── requirements.txt
│   └── Dockerfile
│
├── cli/                             # repohawk CLI
│   ├── repohawk/
│   │   ├── __init__.py
│   │   ├── commands/
│   │   │   ├── init.py              # repohawk init — full analysis + write MD
│   │   │   ├── update.py            # repohawk update — incremental regen
│   │   │   └── status.py            # repohawk status — show staleness
│   │   ├── writer.py                # REPOHAWK.md file builder
│   │   └── hooks.py                 # Git hook install/uninstall
│   └── setup.py
│
├── vscode-extension/                # VS Code extension
│   ├── src/
│   │   ├── extension.ts             # Activation, workspace detection
│   │   ├── sidebar/                 # Webview: diagram panel in VS Code
│   │   └── notifications.ts         # "No REPOHAWK.md found" prompt
│   └── package.json
│
├── docker-compose.yml               # postgres + chromadb + backend + frontend
├── .env.example
└── README.md
```

---

## 7. API Contract (Backend ↔ Frontend)

### Analyze a repository
```
POST /repos/analyze
Body: { "github_url": "https://github.com/owner/repo" }
Response: { "repo_id": "uuid", "status": "queued" }

GET /repos/{repo_id}/stream          ← SSE endpoint
Stream: { "step": "Cloning repo", "status": "running", "elapsed_ms": 1200 }
        { "step": "Parsing AST", "status": "done", "elapsed_ms": 4500 }
        { "step": "Building embeddings", "status": "running", ... }
        { "event": "complete", "repo_id": "uuid" }
```

### Get diagrams
```
GET /repos/{repo_id}/diagrams
Response: [
  {
    "id": "uuid",
    "name": "System Architecture",
    "type": "architecture",
    "mermaid_syntax": "graph TD\n  A-->B...",
    "confidence": { "level": "high", "file_count": 18, "files": [...] },
    "stale": false,
    "stale_reason": null
  }
]
```

### Q&A query
```
POST /chat/query
Body: { "repo_id": "uuid", "question": "where is auth handled?" }
Response: {
  "answer": "Authentication is handled in the `auth/` module...",
  "highlight_node_id": "AuthService",
  "code_ref": { "file": "src/auth/service.py", "line_start": 42, "line_end": 67 },
  "source_files": ["src/auth/service.py", "src/middleware/jwt.py"]
}
```

### Export REPOHAWK.md
```
POST /export/repohawk-md
Body: { "repo_id": "uuid" }
Response: { "markdown": "# Codebase Architecture...", "filename": "REPOHAWK.md" }
```

---

## 8. Key UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `RepoInput` | `components/RepoInput/` | Hero URL bar, GitHub URL validation, recent history |
| `AgentLog` | `components/AgentLog/` | SSE streaming feed of agent steps with elapsed time |
| `DiagramCanvas` | `components/DiagramCanvas/` | D3-zoom Mermaid SVG, node click → CodeSidePanel |
| `CodeSidePanel` | `components/CodeSidePanel/` | File path + line numbers + code snippet, triggered by node click |
| `ConfidenceBadge` | `components/ConfidenceBadge/` | Pill: High/Medium/Low + file count, click for file list |
| `ChatPanel` | `components/ChatPanel/` | Slide-over Q&A, syncs highlight to DiagramCanvas |
| `StalenessTag` | `components/StalenessTag/` | ⚠ badge on stale diagrams, click for diff view |

---

## 9. Agent Pipeline (LangGraph)

```
User submits GitHub URL
        │
        ▼
[Orchestrator Agent]
        │
        ├──► [Codebase Analysis Agent]
        │         Clone repo via GitPython
        │         Parse all files via tree-sitter (AST)
        │         Chunk code into semantic units
        │         Generate embeddings (Nvidia NIM / OpenRouter)
        │         Store in ChromaDB + file→node index in PostgreSQL
        │
        ├──► [Generative Visual Agent]
        │         Query ChromaDB for architecture patterns
        │         Prompt Nvidia NIM / OpenRouter → Mermaid diagram syntax
        │         Generate: architecture diagram + module diagrams
        │         Calculate confidence score per diagram
        │
        ├──► [Critique Agent]
        │         Compare generated diagram against parsed AST
        │         Flag inconsistencies, missing nodes, wrong relationships
        │         Score quality — if below threshold, send back to Visual Agent
        │
        └──► [Context Agent]  ← for REPOHAWK.md export
                  Read inline comments, ADR files, commit messages
                  GitHub API: fetch PR descriptions
                  Extract architectural decisions + gotchas
                  Write AI context hints section of REPOHAWK.md
```

**Git Update Pipeline (triggered by commit):**
```
[Git Agent] detects changed files via post-commit hook
     │
     ├── Map changed files → affected diagram nodes (via file→node index)
     ├── Mark affected diagrams as stale in PostgreSQL
     └── If auto-update enabled: trigger Orchestrator for affected nodes only
```

---

## 10. Database Schema (PostgreSQL)

```sql
-- Core tables

repos (
  id UUID PRIMARY KEY,
  github_url TEXT NOT NULL,
  owner TEXT, name TEXT,
  star_count INT,
  analysis_status TEXT,     -- queued | running | complete | failed
  last_analyzed_at TIMESTAMP,
  file_count INT,
  created_at TIMESTAMP
)

diagrams (
  id UUID PRIMARY KEY,
  repo_id UUID REFERENCES repos(id),
  name TEXT,
  diagram_type TEXT,         -- architecture | module | function | flow
  mermaid_syntax TEXT,
  confidence_level TEXT,     -- high | medium | low
  confidence_file_count INT,
  contributing_files JSONB,  -- array of file paths
  stale BOOLEAN DEFAULT false,
  stale_reason TEXT,
  stale_files JSONB,
  last_commit_sha TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

chat_messages (
  id UUID PRIMARY KEY,
  repo_id UUID REFERENCES repos(id),
  role TEXT,                 -- user | assistant
  content TEXT,
  highlight_node_id TEXT,
  code_ref JSONB,            -- { file, line_start, line_end }
  source_files JSONB,
  created_at TIMESTAMP
)

file_node_index (
  repo_id UUID REFERENCES repos(id),
  file_path TEXT,
  node_id TEXT,              -- diagram node identifier
  PRIMARY KEY (repo_id, file_path, node_id)
)
```

---

## 11. Environment Variables

```env
# LLM
NVIDIA_API_KEY=              # or OPENROUTER_API_KEY

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/repohawk
CHROMA_HOST=localhost
CHROMA_PORT=8000

# GitHub
GITHUB_TOKEN=                # For PR descriptions + star counts

# App
REPOHAWK_API_URL=http://localhost:8000
REPOHAWK_APP_URL=https://repohawk.app
SECRET_KEY=                  # For session signing

# Screenshot
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

---

## 12. MVP Build Order

Build in this exact sequence to get to a demoable state fastest:

1. **Backend skeleton** — FastAPI app, PostgreSQL models, basic `/repos/analyze` endpoint
2. **Codebase Analysis Agent** — clone, parse with tree-sitter, store embeddings in ChromaDB
3. **Generative Visual Agent** — generate Mermaid syntax from embeddings
4. **SSE streaming** — stream agent steps to frontend via `/repos/{id}/stream`
5. **Frontend: Landing + Analysis screens** — RepoInput + AgentLog with live SSE
6. **Frontend: DiagramCanvas** — render Mermaid, D3-zoom, node click
7. **Q&A endpoint + ChatPanel** — RAG pipeline + frontend chat UI
8. **Confidence scoring + ConfidenceBadge** — trust signal on all diagrams
9. **Dashboard screen** — diagram list, stat row
10. **Share page** — public URL, read-only canvas, og:image
11. **REPOHAWK.md export** — Context Agent + CLI `repohawk init`
12. **Staleness detection** — Git Agent + StalenessTag on dashboard

**Defer to post-MVP:** VS Code extension, self-hosted ChromaDB scaling, private repo support, team collaboration features.

---

## 13. AI Assistant Instructions

When working on this codebase, keep these rules in mind:

- **Agent code lives in `backend/app/agents/`** — never put LLM calls directly in routers or services
- **All DB writes go through `backend/app/services/postgres.py`** — never call SQLAlchemy sessions directly from agents or routers
- **Mermaid syntax is always generated by `mermaid_generator.py`** — never build Mermaid strings by hand elsewhere
- **The file→node index in `file_node_index` table is sacred** — it powers both the Q&A highlight sync and the staleness detector; update it whenever diagrams are regenerated
- **SSE streaming uses the pattern in `routers/repos.py`** — always use `EventSourceResponse` from `sse-starlette`, never plain streaming responses
- **Frontend diagram highlight state lives in `useDiagram.js` hook** — ChatPanel and DiagramCanvas both subscribe to it; don't duplicate state
- **Confidence score must be recalculated on every diagram regeneration** — never carry over old scores
- **REPOHAWK.md is append-safe** — the writer always regenerates the full file, never patches sections individually

---

*Generated for Repo Hawk · Akshay Ram · SAMR Systems / UVCE · Bengaluru*
*Feed this file to Claude Code (`claude --context REPOHAWK.md`), Cursor (add to `.cursorrules`), or Windsurf workspace context.*
