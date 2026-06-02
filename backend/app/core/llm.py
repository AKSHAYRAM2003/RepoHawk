"""
RepoHawk LLM Client
Central OpenRouter client factory. All agents import from here.
Supports per-agent model routing via config with automatic retry on rate limits.
"""

import time
import random
import logging
from typing import Optional
from langchain_openai import ChatOpenAI
from openai import RateLimitError
from app.core.config import settings

logger = logging.getLogger("repohawk.llm")


def _invoke_with_retry(llm: ChatOpenAI, prompt_or_messages, input_data: dict = None, max_retries: int = 3):
    """
    Invoke an LLM with exponential backoff retry on 429 rate limits.
    Falls back to MODEL_FALLBACK after exhausting retries.

    Accepts either:
    - A LangChain prompt template + input_data dict
    - A list of BaseMessage (invoke directly, input_data ignored)
    """
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_core.messages import BaseMessage

    def _invoke(llm_instance):
        if isinstance(prompt_or_messages, list) and all(isinstance(m, BaseMessage) for m in prompt_or_messages):
            result = llm_instance.invoke(prompt_or_messages)
            return JsonOutputParser().parse(result.content)
        else:
            chain = prompt_or_messages | llm_instance | JsonOutputParser()
            return chain.invoke(input_data or {})

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return _invoke(llm)
        except (RateLimitError, Exception) as e:
            err_str = str(e).lower()
            is_rate_limit = isinstance(e, RateLimitError) or "429" in err_str or "rate" in err_str or "too many requests" in err_str
            if not is_rate_limit:
                raise
            last_error = e
            if attempt < max_retries:
                wait = (2 ** attempt) + random.uniform(0, 1)
                logger.warning(f"Rate limited (attempt {attempt}/{max_retries}), retrying in {wait:.1f}s...")
                time.sleep(wait)
            else:
                logger.warning(f"Rate limit exhausted after {max_retries} attempts. Trying fallback model...")

    # Fallback: try the fallback model
    logger.info(f"Falling back to {settings.MODEL_FALLBACK}")
    fallback_llm = ChatOpenAI(
        model=settings.MODEL_FALLBACK,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.OPENROUTER_BASE_URL,
        temperature=0.1,
        timeout=60.0,
        default_headers={
            "HTTP-Referer": "https://repohawk.app",
            "X-Title": "RepoHawk",
        },
    )
    return _invoke(fallback_llm)


def invoke_with_fallback(llm: ChatOpenAI, messages, max_retries: int = 3):
    """
    Invokes the LLM with exponential backoff on rate limits/errors,
    and falls back to a chain of alternative free OpenRouter models if it fails.
    """
    import random
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return llm.invoke(messages)
        except (RateLimitError, Exception) as e:
            err_str = str(e).lower()
            is_rate_limit = isinstance(e, RateLimitError) or "429" in err_str or "rate" in err_str or "too many requests" in err_str
            if not is_rate_limit:
                logger.error(f"LLM Invocation failed with non-rate-limit error: {e}")
                raise
            last_error = e
            if attempt < max_retries:
                wait = (2 ** attempt) + random.uniform(0, 1)
                logger.warning(f"LLM Rate limited (attempt {attempt}/{max_retries}), retrying in {wait:.1f}s...")
                time.sleep(wait)
            else:
                logger.warning(f"LLM Rate limit exhausted after {max_retries} attempts. Trying fallback models...")

    # Fallback chain of robust free models
    fallback_models = [
        "qwen/qwen-2-7b-instruct:free",
        "google/gemma-2-9b-it:free",
        "meta-llama/llama-3-8b-instruct:free",
        "microsoft/phi-3-medium-128k-instruct:free",
    ]

    for model_name in fallback_models:
        logger.info(f"LLM Fallback: Trying model {model_name}...")
        try:
            fallback_llm = ChatOpenAI(
                model=model_name,
                openai_api_key=llm.openai_api_key,
                openai_api_base=llm.openai_api_base,
                temperature=llm.temperature,
                timeout=60.0,
                default_headers=llm.default_headers,
            )
            return fallback_llm.invoke(messages)
        except Exception as fallback_err:
            logger.warning(f"LLM Fallback model {model_name} failed: {fallback_err}. Trying next...")
            last_error = fallback_err

    logger.error("LLM Invocation: All primary and fallback models failed.")
    raise last_error


def get_llm(model: Optional[str] = None, temperature: float = 0.2, timeout: float = 120.0) -> ChatOpenAI:
    """
    Creates a LangChain ChatOpenAI instance pointed at OpenRouter.
    
    Args:
        model: OpenRouter model identifier (e.g. "nvidia/nemotron-3-nano-30b-a3b:free").
               Defaults to MODEL_CHAT from config.
        temperature: LLM temperature. Lower = more deterministic.
        timeout: Request timeout in seconds. Longer for free tier models.
    
    Returns:
        ChatOpenAI instance ready for .invoke() / .stream()
    """
    return ChatOpenAI(
        model=model or settings.MODEL_CHAT,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.OPENROUTER_BASE_URL,
        temperature=temperature,
        timeout=timeout,
        default_headers={
            "HTTP-Referer": "https://repohawk.app",
            "X-Title": "RepoHawk",
        },
    )


# Pre-configured clients for each agent role
def get_chat_llm() -> ChatOpenAI:
    """Q&A Agent — high token budget (Nemotron 30B). Temperature 0.1 for grounded code answers."""
    return get_llm(model=settings.MODEL_CHAT, temperature=0.1)


def get_diagram_llm() -> ChatOpenAI:
    """Architect Agent — code-specialized (gpt-oss-120b)"""
    return get_llm(model=settings.MODEL_DIAGRAM, temperature=0.1, timeout=180.0)


def get_critique_llm() -> ChatOpenAI:
    """Critique Agent — strong reasoning (gpt-oss-120b)"""
    return get_llm(model=settings.MODEL_CRITIQUE, temperature=0.0, timeout=120.0)
