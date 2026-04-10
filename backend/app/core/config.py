from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "RepoHawk"
    
    # DB
    DATABASE_URL: str = "postgresql://repohawk_user:repohawk_password@localhost:5432/repohawk_db"
    
    # OpenRouter (All LLM calls go through OpenRouter free tier)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    
    # Per-agent model selection (swap via .env without code changes)
    MODEL_CHAT: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    MODEL_DIAGRAM: str = "qwen/qwen3-coder-480b-a35b:free"
    MODEL_CRITIQUE: str = "openai/gpt-oss-120b:free"
    MODEL_EMBED: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    MODEL_FALLBACK: str = "minimax/minimax-m2.5:free"
    
    # Chroma
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8000
    
    class Config:
        env_file = ".env"

settings = Settings()
