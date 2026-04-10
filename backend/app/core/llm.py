"""
RepoHawk LLM Client
Central OpenRouter client factory. All agents import from here.
Supports per-agent model routing via config.
"""

from typing import Optional
from langchain_openai import ChatOpenAI
from app.core.config import settings


def get_llm(model: Optional[str] = None, temperature: float = 0.2) -> ChatOpenAI:
    """
    Creates a LangChain ChatOpenAI instance pointed at OpenRouter.
    
    Args:
        model: OpenRouter model identifier (e.g. "nvidia/nemotron-3-nano-30b-a3b:free").
               Defaults to MODEL_CHAT from config.
        temperature: LLM temperature. Lower = more deterministic.
    
    Returns:
        ChatOpenAI instance ready for .invoke() / .stream()
    """
    return ChatOpenAI(
        model=model or settings.MODEL_CHAT,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.OPENROUTER_BASE_URL,
        temperature=temperature,
        default_headers={
            "HTTP-Referer": "https://repohawk.app",
            "X-Title": "RepoHawk",
        },
    )


# Pre-configured clients for each agent role
def get_chat_llm() -> ChatOpenAI:
    """Q&A Agent — high token budget (Nemotron 30B)"""
    return get_llm(model=settings.MODEL_CHAT, temperature=0.3)


def get_diagram_llm() -> ChatOpenAI:
    """Architect Agent — code-specialized (Qwen3 Coder)"""
    return get_llm(model=settings.MODEL_DIAGRAM, temperature=0.1)


def get_critique_llm() -> ChatOpenAI:
    """Critique Agent — strong reasoning (gpt-oss-120b)"""
    return get_llm(model=settings.MODEL_CRITIQUE, temperature=0.0)
