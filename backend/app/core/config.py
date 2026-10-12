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
    MODEL_CHAT: str = "nex-agi/nex-n2.5-mini:free"
    MODEL_DIAGRAM: str = "nex-agi/nex-n2.5-mini:free"
    MODEL_CRITIQUE: str = "nex-agi/nex-n2.5-mini:free"
    MODEL_EMBED: str = "nvidia/nemotron-3-embed-1b:free"
    MODEL_FALLBACK: str = "deepseek/deepseek-v4-flash-0731:free"
    MODEL_REWRITE: str = "nex-agi/nex-n2.5-mini:free"

    # ── AWS Bedrock (optional — leave blank to keep using OpenRouter) ─────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    # Set to a named AWS profile (e.g. "repohawk-dev") to use SSO / ~/.aws/credentials
    AWS_PROFILE: str = ""

    # Per-agent provider: "openrouter" | "bedrock"
    # Leave all as "openrouter" to keep current behaviour; flip individual ones to "bedrock"
    LLM_PROVIDER_CHAT: str = "openrouter"
    LLM_PROVIDER_DIAGRAM: str = "openrouter"
    LLM_PROVIDER_CRITIQUE: str = "openrouter"
    LLM_PROVIDER_REWRITE: str = "openrouter"
    LLM_PROVIDER_EMBED: str = "openrouter"  # switching embed requires full re-index!

    # Bedrock model IDs (used only when provider = "bedrock")
    BEDROCK_MODEL_CHAT: str = "amazon.nova-lite-v1:0"
    BEDROCK_MODEL_DIAGRAM: str = "amazon.nova-pro-v1:0"
    BEDROCK_MODEL_CRITIQUE: str = "amazon.nova-pro-v1:0"
    BEDROCK_MODEL_REWRITE: str = "amazon.nova-lite-v1:0"
    BEDROCK_MODEL_EMBED: str = "amazon.titan-embed-text-v2:0"
    
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
    API_URL: str = "http://localhost:8000"
    CLERK_SECRET_KEY: str = ""

    # GitHub App
    GITHUB_APP_ID: str = ""
    GITHUB_APP_PRIVATE_KEY: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""
    GITHUB_APP_CLIENT_ID: str = ""
    GITHUB_APP_CLIENT_SECRET: str = ""

    # Production Infrastructure
    USE_CELERY: bool = False  # Disabled in local/dev to ensure zero-latency instant analysis dispatch
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    VECTOR_STORE_BACKEND: str = "chroma"  # "chroma" or "pgvector"
    SENTRY_DSN: str = ""
    ENVIRONMENT: str = "development"
    
    # Rate Limiting & Safety Guardrails (4-hour sliding window, 5 credits)
    RATE_LIMIT_ANALYSIS_PER_WINDOW: int = 5
    RATE_LIMIT_ANALYSIS_WINDOW_HOURS: int = 4
    RATE_LIMIT_ANALYSIS_WINDOW_SECONDS: int = 14400
    RATE_LIMIT_ANALYSIS_PER_HOUR: int = 5  # kept for backwards compatibility
    RATE_LIMIT_CHAT_PER_MINUTE: int = 20
    MAX_PARSE_FILES: int = 5000
    
    class Config:
        env_file = ".env"
        # Silently ignore unknown env vars (e.g. stale MODEL_EMBED, CHROMA_HOST)
        # so the app doesn't crash when the .env has keys removed from Settings.
        extra = "ignore"

settings = Settings()

