import logging
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.llm import get_chat_llm, invoke_with_fallback

logger = logging.getLogger(__name__)

def analyze_pr_diff(diff: str) -> str:
    """Analyzes a PR diff and generates a review comment using the LLM."""
    if not diff or not diff.strip():
        return "No code changes found in this Pull Request."
        
    llm = get_chat_llm()
    messages = [
        SystemMessage(content=(
            "You are an expert senior software engineer performing a code review. "
            "Analyze the following pull request diff. Provide a constructive, professional review.\n"
            "Focus on:\n"
            "1. Potential bugs or edge cases\n"
            "2. Performance considerations\n"
            "3. Security vulnerabilities\n"
            "4. Architectural and design concerns\n"
            "5. Code quality and maintainability\n\n"
            "Format your response in Markdown. Do not nitpick minor stylistic issues. "
            "If the code looks good, explicitly state that it looks solid."
        )),
        HumanMessage(content=f"Here is the git diff:\n\n{diff}")
    ]
    
    try:
        response = invoke_with_fallback(llm, messages)
        return response.content
    except Exception as e:
        logger.error(f"Failed to analyze PR diff: {e}")
        return "Sorry, I encountered an error while analyzing this Pull Request."
