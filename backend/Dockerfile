# RepoHawk Backend Dockerfile
# Production FastAPI container for DigitalOcean App Platform / VPS
#
# Build from the project root:
#   docker build -t repohawk-api -f backend/Dockerfile backend/
# (build context = backend/, so COPY paths are relative to backend/)

FROM python:3.12-slim

# ── System dependencies ────────────────────────────────────────────────────────
# git: required for cloning repos (GitPython)
# build-essential: required for tree-sitter wheel builds + torch
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ── App directory ──────────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies (layer cache) ──────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Pre-download the local embedding model ─────────────────────────────────────
# all-MiniLM-L6-v2 (~80MB). Without this step, the first API call downloads it,
# which is slow (~30s on a VPS) and can cause a timeout on cold start.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# ── Source code ────────────────────────────────────────────────────────────────
COPY . .

# ── Persistent volumes ─────────────────────────────────────────────────────────
# chroma_db/  — ChromaDB PersistentClient on-disk storage
# chroma_data/ — additional Chroma artifacts
# Both are excluded from the image by .dockerignore; mount real volumes here.
VOLUME ["/app/chroma_db", "/app/chroma_data"]

# ── Environment defaults (override via platform dashboard or .env mount) ───────
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# ── Run ────────────────────────────────────────────────────────────────────────
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]