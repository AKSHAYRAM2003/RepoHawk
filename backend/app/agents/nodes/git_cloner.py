"""
Step 3: Git Cloner Node
Clones a public GitHub repository into a secure temp directory.
This is the first node in the LangGraph Analysis pipeline.

Input:  AnalysisState with repo_url, repo_id
Output: AnalysisState with cloned_path, current_step, progress_log
"""

import os
import re
import shutil
import tempfile
from typing import Dict, Any

from git import Repo, GitCommandError

from app.agents.state import AnalysisState


# Base temp directory for all cloned repos
CLONE_BASE_DIR = os.path.join(tempfile.gettempdir(), "repohawk")


def validate_github_url(url: str) -> bool:
    """
    Validates that the URL is a proper public GitHub repository URL.
    Prevents path traversal and non-GitHub URLs.
    """
    pattern = r'^https://github\.com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+/?$'
    return bool(re.match(pattern, url.strip().removesuffix('.git')))


def get_clone_path(repo_id: str) -> str:
    """Returns a clean, isolated path for cloning a repo."""
    # Sanitize repo_id to prevent path traversal
    safe_id = re.sub(r'[^a-zA-Z0-9_-]', '', repo_id)
    return os.path.join(CLONE_BASE_DIR, safe_id)


def cleanup_clone(repo_id: str) -> None:
    """Removes a previously cloned repo from temp storage."""
    clone_path = get_clone_path(repo_id)
    if os.path.exists(clone_path):
        shutil.rmtree(clone_path, ignore_errors=True)


def git_cloner_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Clones a GitHub repository.

    Args:
        state: Current AnalysisState (as dict — LangGraph passes dicts)

    Returns:
        Partial state update with cloned_path, current_step, progress_log
    """
    repo_url = state["repo_url"].strip()
    repo_id = state["repo_id"]

    # Normalize URL (ensure protocol prefix)
    if not repo_url.startswith("http://") and not repo_url.startswith("https://"):
        repo_url = "https://" + repo_url

    # Fallback for org/profile links: if length of path segments is 1 (excluding github.com),
    # assume repo name is same as org/user name (e.g. github.com/openclaw -> github.com/openclaw/openclaw)
    url_parts = repo_url.rstrip("/").split("/")
    if len(url_parts) == 4 and url_parts[2] == "github.com":
        repo_url = f"{repo_url.rstrip('/')}/{url_parts[3]}"

    # Validate URL
    if not validate_github_url(repo_url):
        return {
            "error": f"Invalid GitHub URL: {repo_url}",
            "current_step": "error",
            "progress_log": [f"❌ Invalid GitHub URL: {repo_url}"],
        }


    clone_path = get_clone_path(repo_id)

    # Clean up any previous clone for this repo
    cleanup_clone(repo_id)

    # Ensure base directory exists
    os.makedirs(CLONE_BASE_DIR, exist_ok=True)

    try:
        # Clone with depth=1 + filter=blob:none for speed and to prevent
        # huge repos from exhausting disk. Content is fetched on demand by tree-sitter.
        Repo.clone_from(
            repo_url,
            clone_path,
            depth=1,
            single_branch=True,
            filter="blob:none",
        )

        return {
            "cloned_path": clone_path,
            "current_step": "cloning_complete",
            "progress_log": [f"✅ Cloned {repo_url} to {clone_path}"],
        }

    except GitCommandError as e:
        return {
            "error": f"Git clone failed: {str(e)}",
            "current_step": "error",
            "progress_log": [f"❌ Clone failed for {repo_url}: {str(e)}"],
        }
    except Exception as e:
        return {
            "error": f"Unexpected error during cloning: {str(e)}",
            "current_step": "error",
            "progress_log": [f"❌ Unexpected error: {str(e)}"],
        }
