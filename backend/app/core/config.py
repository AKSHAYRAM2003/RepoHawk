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
    MODEL_EMBED: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    MODEL_FALLBACK: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    MODEL_REWRITE: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    
    # Chroma
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000
    
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

settings = Settings()
