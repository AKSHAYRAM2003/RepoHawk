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
    # Models that don't support tool-calling return this; treat as model-switch signal
    if "model output must contain" in err_str:
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

    import re
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    else:
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            text = text[brace_start:brace_end + 1]

    import json
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try repairing trailing commas before closing braces/brackets
        cleaned = re.sub(r",\s*([\]}])", r"\1", text)
        return json.loads(cleaned)


def _invoke_with_retry(llm: ChatOpenAI, prompt_or_messages, input_data: dict = None, max_retries: int = 3):
    """
    Invoke an LLM with exponential backoff retry on transient errors.
    Falls back to MODEL_FALLBACK after exhausting retries.

    Accepts either:
    - A LangChain prompt template + input_data dict
    - A list of BaseMessage (invoke directly, input_data ignored)

    Returns: parsed JSON dict from the LLM response.
    """
    import json
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
            elif isinstance(e, (json.JSONDecodeError, ValueError, TypeError)) or "JSON" in type(e).__name__.upper() or "JSON" in str(e).upper() or "EXPECTING VALUE" in str(e).upper():
                # JSON parse failures or None content from models -> retry or fallback
                last_error = e
                if attempt < max_retries:
                    wait = 1.0 + random.uniform(0, 0.5)
                    logger.warning(f"Output parse/format error (attempt {attempt}/{max_retries}): {e!s:.120} — retrying...")
                    time.sleep(wait)
                else:
                    logger.warning(f"Format retries exhausted. Trying fallback model...")
                    break
            else:
                err_text = str(e).lower()
                if any(x in err_text for x in ["404", "not found", "unavailable", "deprecated", "rate", "429", "nonetype", "not iterable", "choices", "agentic"]):
                    logger.warning(f"Model error ({e!s:.120}) — switching to fallback models...")
                    break
                # Non-transient error (auth, malformed request, etc.) — don't retry
                logger.error(f"Non-retryable LLM error: {e!s:.120}")
                raise

    # Fallback: try reliable fallback models sequentially
    fallback_models = [
        settings.MODEL_FALLBACK,
        "mistralai/mistral-nemo",
        "nex-agi/nex-n2.5-mini:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "nex-agi/nex-n2.5-pro:free",
        "cohere/north-mini-code:free",
    ]
    # Remove duplicates preserving order
    seen = set()
    unique_fallbacks = [m for m in fallback_models if m and not (m in seen or seen.add(m))]

    for f_model in unique_fallbacks:
        logger.info(f"Trying fallback model {f_model}")
        try:
            fallback_llm = ChatOpenAI(
                model=f_model,
                openai_api_key=settings.OPENROUTER_API_KEY,
                openai_api_base=settings.OPENROUTER_BASE_URL,
                temperature=0.1,
                timeout=60.0,
                max_retries=0,
                default_headers={
                    "HTTP-Referer": "https://repohawk.app",
                    "X-Title": "RepoHawk",
                },
            )
            return _invoke(fallback_llm)
        except Exception as fallback_err:
            logger.warning(f"Fallback model {f_model} failed: {fallback_err!s:.120}. Trying next...")
            last_error = fallback_err

    logger.error("All fallback models failed.")
    raise last_error or RuntimeError("LLM invocation failed across all primary and fallback models.")


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
                err_str = str(e).lower()
                # Non-tool-calling models or empty-output errors — switch model immediately
                if any(x in err_str for x in ["model output must contain", "404", "not found", "unavailable", "deprecated"]):
                    logger.warning(f"Model capability error ({e!s:.120}) — switching to fallback models immediately...")
                    last_error = e
                    break
                logger.error(f"Non-retryable LLM error: {e!s:.120}")
                raise

    # Fallback chain of free models (ordered by empirical reliability on OpenRouter)
    fallback_models = [
        getattr(llm, "model_name", None) or settings.MODEL_DIAGRAM,
        settings.MODEL_FALLBACK,
        "nex-agi/nex-n2.5-mini:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "nex-agi/nex-n2.5-pro:free",
        "cohere/north-mini-code:free",
    ]
    seen = set()
    unique_fallbacks = [m for m in fallback_models if m and not (m in seen or seen.add(m))]

    for model_name in unique_fallbacks:
        logger.info(f"LLM Fallback: Trying model {model_name}...")
        try:
            fallback_llm = ChatOpenAI(
                model=model_name,
                openai_api_key=settings.OPENROUTER_API_KEY,
                openai_api_base=settings.OPENROUTER_BASE_URL,
                temperature=getattr(llm, "temperature", 0.2),
                timeout=60.0,
                default_headers=getattr(llm, "default_headers", None),
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
        max_retries=0,
        default_headers={
            "HTTP-Referer": "https://repohawk.app",
            "X-Title": "RepoHawk",
        },
    )


# Pre-configured clients for each agent role
# Each factory checks its per-agent LLM_PROVIDER_* setting so you can mix
# Bedrock and OpenRouter models in the same running instance.

def get_chat_llm():
    """Q&A Agent. Routes to Bedrock when LLM_PROVIDER_CHAT=bedrock."""
    if settings.LLM_PROVIDER_CHAT == "bedrock":
        from app.core.bedrock import get_bedrock_llm
        return get_bedrock_llm("chat")
    return get_llm(model=settings.MODEL_CHAT, temperature=0.1, timeout=30.0)


def get_rewrite_llm():
    """Query Rewriting. Routes to Bedrock when LLM_PROVIDER_REWRITE=bedrock.
    Separate from get_chat_llm so we don't burn the main model token budget on rewrites."""
    if settings.LLM_PROVIDER_REWRITE == "bedrock":
        from app.core.bedrock import get_bedrock_llm
        return get_bedrock_llm("rewrite")
    return get_llm(model=settings.MODEL_REWRITE, temperature=0.0, timeout=15.0)


def get_diagram_llm():
    """Architect Agent. Routes to Bedrock when LLM_PROVIDER_DIAGRAM=bedrock."""
    if settings.LLM_PROVIDER_DIAGRAM == "bedrock":
        from app.core.bedrock import get_bedrock_llm
        return get_bedrock_llm("diagram")
    return get_llm(model=settings.MODEL_DIAGRAM, temperature=0.1, timeout=60.0)


def get_critique_llm():
    """Critique Agent. Routes to Bedrock when LLM_PROVIDER_CRITIQUE=bedrock."""
    if settings.LLM_PROVIDER_CRITIQUE == "bedrock":
        from app.core.bedrock import get_bedrock_llm
        return get_bedrock_llm("critique")
    return get_llm(model=settings.MODEL_CRITIQUE, temperature=0.0, timeout=30.0)
