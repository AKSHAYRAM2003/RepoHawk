"""
RepoHawk LLM Client
Central OpenRouter client factory. All agents import from here.
Supports per-agent model routing via config with automatic retry on rate limits
AND transient connection errors (the #1 cause of pipeline failures on free-tier).
"""

import time
import random
import logging
from typing import Optional
from langchain_openai import ChatOpenAI
from openai import RateLimitError, APIConnectionError, APIStatusError
from app.core.config import settings

logger = logging.getLogger("repohawk.llm")

# Transient errors that are worth retrying on free-tier OpenRouter
_RETRYABLE_ERRORS = (RateLimitError, APIConnectionError)

def _is_retryable(exc: Exception) -> bool:
    """True if the error is transient and likely to succeed on retry."""
    if isinstance(exc, _RETRYABLE_ERRORS):
        return True
    err_str = str(exc).lower()
    # OpenRouter wraps provider failures in generic messages
    if any(kw in err_str for kw in ("429", "rate", "too many requests", "connection", "timeout", "timed out")):
        return True
    # 5xx server errors from OpenRouter itself
    if isinstance(exc, APIStatusError) and exc.status_code >= 500:
        return True
    return False


def _extract_json(text: str) -> dict:
    """
    Robustly extract a JSON dict from LLM output.
    Handles: raw JSON, markdown-fenced (```json ... ```), leading/trailing prose,
    and None content from reasoning-only models.
    """
    if not text or not text.strip():
        raise ValueError("LLM returned empty/None content — model may be a reasoning-only model")

    text = text.strip()

    # Strip markdown fences: ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        # Find the closing fence
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.endswith("```"):
            text = text[:-3]
        # Also handle trailing newlines before closing fence
        text = text.rstrip("`").strip()

    # Try to find a JSON object within the text (handle leading prose)
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        text = text[brace_start:brace_end + 1]

    import json
    return json.loads(text)


def _invoke_with_retry(llm: ChatOpenAI, prompt_or_messages, input_data: dict = None, max_retries: int = 3):
    """
    Invoke an LLM with exponential backoff retry on transient errors.
    Falls back to MODEL_FALLBACK after exhausting retries.

    Accepts either:
    - A LangChain prompt template + input_data dict
    - A list of BaseMessage (invoke directly, input_data ignored)

    Returns: parsed JSON dict from the LLM response.
    """
    from langchain_core.messages import BaseMessage

    def _invoke(llm_instance):
        if isinstance(prompt_or_messages, list) and all(isinstance(m, BaseMessage) for m in prompt_or_messages):
            result = llm_instance.invoke(prompt_or_messages)
            content = getattr(result, "content", None) or ""
            return _extract_json(content)
        else:
            chain = prompt_or_messages | llm_instance
            result = chain.invoke(input_data or {})
            content = getattr(result, "content", None) or ""
            return _extract_json(content)

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return _invoke(llm)
        except Exception as e:
            if _is_retryable(e):
                last_error = e
                if attempt < max_retries:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    logger.warning(f"Transient error (attempt {attempt}/{max_retries}): {e!s:.120} — retrying in {wait:.1f}s...")
                    time.sleep(wait)
                else:
                    logger.warning(f"Retries exhausted after {max_retries} attempts. Trying fallback model...")
            elif "OutputParserException" in type(e).__name__ or "JSON" in str(e).upper():
                # JSON parse failures are often model-specific; retry can help
                last_error = e
                if attempt < max_retries:
                    wait = 1.0 + random.uniform(0, 0.5)
                    logger.warning(f"JSON parse error (attempt {attempt}/{max_retries}): {e!s:.120} — retrying...")
                    time.sleep(wait)
                else:
                    logger.warning(f"JSON parse retries exhausted. Trying fallback model...")
            else:
                # Non-transient error (auth, malformed request, etc.) — don't retry
                logger.error(f"Non-retryable LLM error: {e!s:.120}")
                raise

    # Fallback: try the fallback model with its own error handling
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
    try:
        return _invoke(fallback_llm)
    except Exception as fallback_err:
        logger.error(f"Fallback model also failed: {fallback_err}")
        raise


def invoke_with_fallback(llm: ChatOpenAI, messages, max_retries: int = 3):
    """
    Invokes the LLM with exponential backoff on transient errors,
    and falls back to a chain of alternative free OpenRouter models if it fails.
    """
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return llm.invoke(messages)
        except Exception as e:
            if _is_retryable(e):
                last_error = e
                if attempt < max_retries:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    logger.warning(f"Transient error (attempt {attempt}/{max_retries}): {e!s:.120} — retrying in {wait:.1f}s...")
                    time.sleep(wait)
                else:
                    logger.warning(f"Retries exhausted after {max_retries} attempts. Trying fallback models...")
            else:
                logger.error(f"Non-retryable LLM error: {e!s:.120}")
                raise

    # Fallback chain of free models (ordered by empirical reliability on OpenRouter)
    fallback_models = [
        settings.MODEL_DIAGRAM,       # Same model, already loaded in router
        "nvidia/nemotron-3-nano-30b-a3b:free",  # Fast (~2s), reliable
        "google/gemma-4-26b-a4b-it:free",        # Good quality, moderate speed
        "meta-llama/llama-3.3-70b-instruct:free", # Strong, sometimes rate-limited
    ]

    for model_name in fallback_models:
        logger.info(f"LLM Fallback: Trying model {model_name}...")
        try:
            fallback_llm = ChatOpenAI(
                model=model_name,
                openai_api_key=settings.OPENROUTER_API_KEY,
                openai_api_base=settings.OPENROUTER_BASE_URL,
                temperature=llm.temperature,
                timeout=60.0,
                default_headers=llm.default_headers,
            )
            return fallback_llm.invoke(messages)
        except Exception as fallback_err:
            logger.warning(f"LLM Fallback model {model_name} failed: {fallback_err!s:.120}. Trying next...")
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
    """Q&A Agent — fast model with good code understanding.
    Timeout 30s: free-tier models that stall >30s are unlikely to recover."""
    return get_llm(model=settings.MODEL_CHAT, temperature=0.1, timeout=30.0)


def get_rewrite_llm() -> ChatOpenAI:
    """Query Rewriting — cheap fast model (nemotron-3-nano-30b). Short response, plain text output.
    Separate from get_chat_llm so we don't burn the main model token budget on rewrites."""
    return get_llm(model=settings.MODEL_REWRITE, temperature=0.0, timeout=15.0)


def get_diagram_llm() -> ChatOpenAI:
    """Architect Agent — strong reasoning model for architecture diagram generation"""
    return get_llm(model=settings.MODEL_DIAGRAM, temperature=0.1, timeout=60.0)


def get_critique_llm() -> ChatOpenAI:
    """Critique Agent — strong reasoning for diagram quality assessment"""
    return get_llm(model=settings.MODEL_CRITIQUE, temperature=0.0, timeout=30.0)
