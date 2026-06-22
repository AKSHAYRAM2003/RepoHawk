import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Bootstrap SQLAlchemy models registry to avoid InvalidRequestError
from app.models.base import Base

from app.api.v1.routers import repos, chat, auth
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("repohawk")

# ── Startup validation ────────────────────────────────────────────────────────
def _validate_config():
    """Fail-fast if security-critical settings are still defaults."""
    if settings.JWT_SECRET_KEY == "change-me":
        raise RuntimeError(
            "JWT_SECRET_KEY is still the default 'change-me'. "
            "Set a strong secret in your .env file before starting."
        )
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Set it in your .env file."
        )

# ── CORS origins ─────────────────────────────────────────────────────────────
_origins = [settings.FRONTEND_URL]

app = FastAPI(title="RepoHawk API", version="1.0.0")

# Security and CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include core routers
app.include_router(repos.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")

@app.on_event("startup")
async def startup():
    _validate_config()
    # Recover any repos stuck in 'running'/'queued' from a previous server crash/restart.
    from app.services.analysis import recover_stale_analyses
    from app.core.database import async_session_maker
    await recover_stale_analyses(async_session_maker)
    logger.info(f"RepoHawk starting — CORS origins: {_origins}")


@app.get("/")
def health_check():
    return {"status": "healthy", "service": "RepoHawk API"}
