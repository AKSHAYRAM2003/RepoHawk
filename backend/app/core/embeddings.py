"""
RepoHawk Embeddings Client
Central factory for codebase embedding using OpenRouter free models.
"""

from langchain_openai import OpenAIEmbeddings
from app.core.config import settings

def get_embeddings():
    """
    Returns a LangChain OpenAIEmbeddings instance pointed at OpenRouter.
    Using the dedicated embedding model defined in config.
    """
    return OpenAIEmbeddings(
        model=settings.MODEL_EMBED,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.OPENROUTER_BASE_URL,
    )

