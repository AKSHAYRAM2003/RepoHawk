import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Bootstrap SQLAlchemy models registry to avoid InvalidRequestError
from app.models.base import Base

from app.api.v1.routers import repos, chat, auth, github, notifications
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
# FastAPI's CORSMiddleware does not support wildcard sub-domains (e.g. *.vercel.app).
# We build an explicit list of patterns covering:
#   1. Production: https://repohawk.app  and  https://www.repohawk.app
#   2. FRONTEND_URL env var (DigitalOcean preview / staging)
#   3. Vercel preview deployments: https://repohawk-git-*.vercel.app
#   4. Local development: http://localhost:3000  and  http://127.0.0.1:3000
import re as _re

_ALLOWED_ORIGIN_PATTERNS = [
    _re.compile(r"^https://repohawk\.app$"),
    _re.compile(r"^https://www\.repohawk\.app$"),
    _re.compile(r"^https://api\.repohawk\.app$"),
    _re.compile(r"^https://repohawk(-git-[a-z0-9\-]+)?-akshayram\.vercel\.app$"),
    _re.compile(r"^https://repohawk[a-z0-9\-]*\.vercel\.app$"),
    _re.compile(r"^http://localhost(:\d+)?$"),
    _re.compile(r"^http://127\.0\.0\.1(:\d+)?$"),
]

# Also always allow the explicit FRONTEND_URL env var (covers staging / custom)
_FRONTEND_URL_EXPLICIT = settings.FRONTEND_URL


def _is_allowed_origin(origin: str) -> bool:
    if origin == _FRONTEND_URL_EXPLICIT:
        return True
    return any(pat.match(origin) for pat in _ALLOWED_ORIGIN_PATTERNS)

# Build the list passed to CORSMiddleware — include known-static URLs plus a
# sentinel so FastAPI's built-in allow_origins doesn't short-circuit everything.
# The real per-request gate is allow_origin_regex (set below).
_origins = [
    "https://repohawk.app",
    "https://www.repohawk.app",
    _FRONTEND_URL_EXPLICIT,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle (replaces the deprecated @app.on_event)."""
    _validate_config()
    # Recover any repos stuck in 'running'/'queued' from a previous server crash/restart.
    from app.services.analysis import recover_stale_analyses
    from app.core.database import async_session_maker
    await recover_stale_analyses(async_session_maker)
    logger.info(f"RepoHawk starting — CORS origins: {_origins}")

    # Background task: clean up stale rate-limit buckets every hour
    import asyncio
    async def _rate_limiter_cleanup():
        from app.services.rate_limit import chat_limiter
        while True:
            try:
                await asyncio.sleep(3600)  # 1 hour
                chat_limiter.cleanup(max_age_secs=3600)
                logger.debug("Rate limiter: stale buckets cleaned up.")
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning(f"Rate limiter cleanup error: {exc}")
    cleanup_task = asyncio.create_task(_rate_limiter_cleanup())

    yield

    # Shutdown: cancel the cleanup task cleanly
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="RepoHawk API", version="1.0.0", lifespan=lifespan)

# Security and CORS setup
# allow_origins covers production + localhost (static, fast path)
# allow_origin_regex covers Vercel preview deployments (dynamic sub-domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://repohawk[a-z0-9\-]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include core routers
app.include_router(repos.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(github.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")


@app.get("/")
def health_check():
    return {"status": "healthy", "service": "RepoHawk API"}
