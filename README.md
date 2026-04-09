# RepoHawk 🦅

**An AI-powered agentic system that automatically generates architecture diagrams and semantic documentation from repository structures.**

RepoHawk is an enterprise-grade fullstack AI application that combines code intelligence, LLM reasoning, and conversational AI to help developers understand and document complex codebases at scale.

---

## 🎯 What is RepoHawk?

RepoHawk analyzes any Git repository and automatically:
1. **Parses** the codebase using semantic AST analysis (`tree-sitter`)
2. **Generates** architecture diagrams in Mermaid.js format
3. **Provides** intelligent Q&A through RAG (Retrieval-Augmented Generation)
4. **Maintains** conversation memory for seamless interaction

Perfect for onboarding, documentation, code reviews, and architecture understanding.

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  Next.js 14+    │ ← Frontend (TypeScript, Tailwind, React Query)
│   Frontend      │
└────────┬────────┘
         │ REST / Server Actions
┌────────▼────────┐
│   FastAPI       │ ← Backend (Async ASIO, LangGraph Agents)
│   Backend       │
└────────┬────────┘
         │
    ┌────┼────────────┐
    │                 │
┌───▼────┐      ┌────▼──────┐
│ Postgres│      │ ChromaDB  │
│ (State) │      │(Vectors) │
└─────────┘      └──────────┘
    │                 ▲
    └─────────────────┘
    Agent Orchestration
    (Tree-Sitter + LLMs)
```

### Key Components

| Layer | Stack | Purpose |
|-------|-------|---------|
| **Frontend** | Next.js 14, TypeScript, Tailwind, shadcn/ui | User interface, diagram visualization, chat |
| **Backend** | FastAPI, Python, SQLAlchemy | API, business logic, LLM orchestration |
| **Agents** | LangGraph, Nvidia NIM / OpenRouter | Autonomous code analysis and diagram generation |
| **Data** | PostgreSQL + ChromaDB | Persistent storage and vector embeddings |
| **Parsing** | tree-sitter | Semantic code analysis across 5+ languages |

---

## 📚 Documentation

For detailed architecture and implementation information, see:

- **[Production Architecture](./docs/production_architecture.md)** — Complete tech stack, folder structure, design patterns
- **[Implementation Plan](./docs/implementation_plan.md)** — System topology, agentic pipeline, database schema

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd RepoHawk
   ```

2. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```
   This starts:
   - PostgreSQL (metadata & state)
   - ChromaDB (vector embeddings)
   - Backend FastAPI server
   - Frontend Next.js dev server

3. **Backend Setup**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   alembic upgrade head  # Apply database migrations
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API Docs: http://localhost:8000/docs

---

## 📁 Project Structure

```
RepoHawk/
├── frontend/              # Next.js application (TypeScript, React)
│   ├── src/
│   │   ├── app/          # Routing & pages
│   │   ├── components/   # UI & feature components
│   │   ├── hooks/        # React Query hooks
│   │   ├── lib/          # API client, utilities
│   │   └── store/        # Zustand global state
│   └── package.json
│
├── backend/              # FastAPI application (Python)
│   ├── app/
│   │   ├── api/          # FastAPI routers & endpoints
│   │   ├── services/     # Business logic layer
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── agents/       # LangGraph orchestration & nodes
│   │   ├── core/         # Config, database, logging
│   │   └── utils/        # Helpers, AST parsers
│   ├── alembic/          # Database migrations
│   ├── requirements.txt   # Python dependencies
│   └── main.py           # Entry point
│
├── docker-compose.yml    # Local dev environment (Postgres, ChromaDB)
├── README.md             # This file
└── REPOHAWK.md          # Generated project context
```

---

## 🔧 Core Features

### 1. Repository Analysis
- Clones repositories securely
- Parses code using semantic AST (tree-sitter)
- Extracts module relationships and dependencies
- Generates code embeddings for vector search

### 2. Architecture Diagram Generation
- LLM-powered diagram generation in Mermaid.js format
- Automated quality critique and retry logic
- Interactive visualization in the frontend

### 3. Conversational RAG
- Query-based code understanding
- Context-aware responses using retrieved code snippets
- Persistent conversation memory per session
- Multi-turn dialogue support

---

## 🛠️ Development

### Backend Development

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload

# View API docs
# Open http://localhost:8000/docs
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Build for production
npm run build
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm run test
```

---

## 🔐 Environment Variables

Create `.env.local` in both `frontend/` and `backend/` directories:

**Backend (`backend/.env.local`)**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/repohawk
CHROMADB_HOST=localhost
CHROMADB_PORT=8000
OPENAI_API_KEY=sk-...
NVIDIA_NIM_API_KEY=nvapi-...
DEBUG=false
```

**Frontend (`frontend/.env.local`)**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=RepoHawk
```

---

## 📊 Tech Stack Summary

| Component | Technology |
|-----------|------------|
| **Frontend UI** | Next.js 14, React, TypeScript, Tailwind CSS |
| **UI Components** | shadcn/ui (Radix Primitives) |
| **State Management** | React Query (server), Zustand (client) |
| **Visualization** | Mermaid.js + D3.js |
| **Backend** | FastAPI, Python 3.11+ |
| **ORM** | SQLAlchemy 2.0 |
| **Agent Framework** | LangGraph |
| **Code Parsing** | tree-sitter (Python, JS, TS, Go, etc.) |
| **LLM Integration** | Nvidia NIM, OpenRouter |
| **Database** | PostgreSQL (metadata), ChromaDB (vectors) |
| **Containerization** | Docker & Docker Compose |
| **Migrations** | Alembic |

---

## 🚢 Deployment

### Docker Production Build

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

1. **Backend**: Deploy FastAPI to cloud platform (AWS, GCP, Azure)
2. **Frontend**: Deploy Next.js to Vercel or similar
3. **Database**: Managed PostgreSQL service
4. **Vector Store**: Hosted ChromaDB or cloud equivalent

---

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License — see the LICENSE file for details.

---

## 👥 Contact & Support

For questions, issues, or suggestions:
- 📧 Email: support@repohawk.dev
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-repo/discussions)

---

## 🎓 Learning Resources

- **[Next.js Documentation](https://nextjs.org/docs)**
- **[FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)**
- **[LangGraph Documentation](https://langchain-ai.github.io/langgraph/)**
- **[tree-sitter](https://tree-sitter.github.io/tree-sitter/)**
- **[SQLAlchemy 2.0](https://docs.sqlalchemy.org/)**

---

**Built with ❤️ for developers who love clean architecture and AI-powered tooling.**
