"""
Unit Tests for Step 1: LLM Client Setup
Tests that the OpenRouter client factory creates valid LangChain instances
with the correct model/config for each agent role.
"""

import sys
import os

# Set a dummy key for testing (no real API calls are made in unit tests)
os.environ["OPENROUTER_API_KEY"] = os.environ.get("OPENROUTER_API_KEY", "sk-test-dummy-key-for-unit-tests")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.llm import get_llm, get_chat_llm, get_diagram_llm, get_critique_llm
from app.core.config import settings
from langchain_openai import ChatOpenAI


def test_get_llm_returns_chatopenai():
    """Verify get_llm() returns a ChatOpenAI instance"""
    llm = get_llm()
    assert isinstance(llm, ChatOpenAI), f"Expected ChatOpenAI, got {type(llm)}"
    print("✅ get_llm() returns ChatOpenAI instance")


def test_default_model_is_chat():
    """Verify default model is the chat model (Nemotron)"""
    llm = get_llm()
    assert llm.model_name == settings.MODEL_CHAT, (
        f"Expected {settings.MODEL_CHAT}, got {llm.model_name}"
    )
    print(f"✅ Default model is {settings.MODEL_CHAT}")


def test_custom_model_override():
    """Verify passing a model name overrides the default"""
    llm = get_llm(model="test/custom-model")
    assert llm.model_name == "test/custom-model"
    print("✅ Custom model override works")


def test_chat_llm_uses_correct_model():
    """Verify get_chat_llm() uses Nemotron"""
    llm = get_chat_llm()
    assert llm.model_name == settings.MODEL_CHAT
    print(f"✅ Chat LLM → {settings.MODEL_CHAT}")


def test_diagram_llm_uses_correct_model():
    """Verify get_diagram_llm() uses Qwen3 Coder"""
    llm = get_diagram_llm()
    assert llm.model_name == settings.MODEL_DIAGRAM
    print(f"✅ Diagram LLM → {settings.MODEL_DIAGRAM}")


def test_critique_llm_uses_correct_model():
    """Verify get_critique_llm() uses gpt-oss-120b"""
    llm = get_critique_llm()
    assert llm.model_name == settings.MODEL_CRITIQUE
    print(f"✅ Critique LLM → {settings.MODEL_CRITIQUE}")


def test_diagram_llm_has_low_temperature():
    """Diagram generation needs deterministic output (low temp)"""
    llm = get_diagram_llm()
    assert llm.temperature == 0.1, f"Expected 0.1, got {llm.temperature}"
    print("✅ Diagram LLM temperature = 0.1 (deterministic)")


def test_critique_llm_has_zero_temperature():
    """Critique validation needs fully deterministic output"""
    llm = get_critique_llm()
    assert llm.temperature == 0.0, f"Expected 0.0, got {llm.temperature}"
    print("✅ Critique LLM temperature = 0.0 (fully deterministic)")


def test_openrouter_base_url():
    """Verify all clients point to OpenRouter's base URL"""
    llm = get_llm()
    # LangChain stores the base URL in the client's config
    assert "openrouter.ai" in str(llm.openai_api_base), (
        f"Expected openrouter.ai in base URL, got {llm.openai_api_base}"
    )
    print(f"✅ Base URL points to OpenRouter: {llm.openai_api_base}")


if __name__ == "__main__":
    print("\n🧪 Running Step 1 Unit Tests: LLM Client Setup\n" + "=" * 50)
    test_get_llm_returns_chatopenai()
    test_default_model_is_chat()
    test_custom_model_override()
    test_chat_llm_uses_correct_model()
    test_diagram_llm_uses_correct_model()
    test_critique_llm_uses_correct_model()
    test_diagram_llm_has_low_temperature()
    test_critique_llm_has_zero_temperature()
    test_openrouter_base_url()
    print("\n" + "=" * 50)
    print("✅ All 9 tests passed! Step 1 complete.\n")
