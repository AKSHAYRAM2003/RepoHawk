from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "RepoHawk"
    
    # DB
    DATABASE_URL: str = "postgresql://repohawk_user:repohawk_password@localhost:5432/repohawk_db"
    
    # OpenRouter (All LLM calls go through OpenRouter free tier)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    
    # Per-agent model selection (swap via .env without code changes)
    MODEL_CHAT: str = "openai/gpt-oss-20b:free"
    MODEL_DIAGRAM: str = "openai/gpt-oss-120b:free"
    MODEL_CRITIQUE: str = "openai/gpt-oss-120b:free"
    MODEL_EMBED: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    MODEL_FALLBACK: str = "meta-llama/llama-3.2-3b-instruct:free"
    MODEL_REWRITE: str = "meta-llama/llama-3.2-3b-instruct:free"   # cheap fast model for query rewriting
    
    # Chroma
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000
    
    class Config:
        env_file = ".env"

settings = Settings()
