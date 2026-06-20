import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Bootstrap SQLAlchemy models registry to avoid InvalidRequestError
from app.models.base import Base

from app.api.v1.routers import repos, chat, auth

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("repohawk")

app = FastAPI(title="RepoHawk API", version="1.0.0")

# Security and CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend deployment URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include core routers
app.include_router(repos.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "RepoHawk API"}
