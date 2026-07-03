from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "RepoHawk"
    
    # DB
    DATABASE_URL: str = "postgresql://repohawk_user:repohawk_password@localhost:5432/repohawk_db"
    
    # OpenRouter (All LLM calls go through OpenRouter free tier)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    
    # Per-agent model selection (swap via .env without code changes)
    # NOTE: gpt-oss-20b:free is broken (returns None content). Using nemotron-3-nano-30b-a3b:free
    #       which is fast (~2s) and reliably returns grounded code answers.
    MODEL_CHAT: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    MODEL_DIAGRAM: str = "openai/gpt-oss-120b:free"
    MODEL_CRITIQUE: str = "openai/gpt-oss-120b:free"
    # NOTE: Embeddings are computed LOCALLY via sentence-transformers
    # (all-MiniLM-L6-v2, 384-dim) — see app/core/embeddings.py. There is no
    # remote embedding model, so no MODEL_EMBED setting is needed here.
    MODEL_FALLBACK: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    MODEL_REWRITE: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    
    # Chroma runs embedded/on-disk via a PersistentClient (see
    # app/core/vector_store.py) — there is no separate Chroma server, so no
    # host/port settings are needed here.

    # Auth — JWT_SECRET_KEY MUST be overridden in .env. App refuses to start with the default.
    JWT_SECRET_KEY: str = "change-me"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESEND_API_KEY: str = ""
    RESEND_WELCOME_TEMPLATE_ID: str = ""
    RESEND_PASSWORD_RESET_TEMPLATE_ID: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    
    class Config:
        env_file = ".env"
        # Silently ignore unknown env vars (e.g. stale MODEL_EMBED, CHROMA_HOST)
        # so the app doesn't crash when the .env has keys removed from Settings.
        extra = "ignore"

settings = Settings()

