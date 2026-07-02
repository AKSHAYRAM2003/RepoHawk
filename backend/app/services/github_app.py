import os
import logging
from github import Github, GithubIntegration, Auth

logger = logging.getLogger(__name__)

def get_github_integration() -> GithubIntegration:
    """Creates a GithubIntegration instance using App ID and Private Key from env."""
    app_id = os.getenv("GITHUB_APP_ID")
    
    # Try file path first (useful for docker/secrets)
    private_key_path = os.getenv("GITHUB_PRIVATE_KEY_PATH", "")
    if private_key_path and os.path.exists(private_key_path):
        with open(private_key_path, 'r') as f:
            private_key = f.read()
    else:
        # Fallback to direct env var, replacing literal \n with real newlines
        private_key = os.getenv("GITHUB_PRIVATE_KEY", "").replace("\\n", "\n")

    if not app_id or not private_key:
        logger.error("Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY in environment variables.")
        raise ValueError("GitHub App configuration is missing")

    auth = Auth.AppAuth(app_id, private_key)
    return GithubIntegration(auth=auth)

def get_installation_client(installation_id: int) -> Github:
    """Gets an authenticated PyGithub client for a specific installation."""
    integration = get_github_integration()
    # Fetch a short-lived token for this specific installation
    auth_token = integration.get_access_token(installation_id)
    return Github(auth=Auth.Token(auth_token.token))

def get_pr_diff(installation_id: int, repo_name: str, pr_number: int) -> str:
    """Gets the raw unified diff for a PR by iterating over its files."""
    client = get_installation_client(installation_id)
    repo = client.get_repo(repo_name)
    pr = repo.get_pull(pr_number)
    
    diff_lines = []
    for file in pr.get_files():
        diff_lines.append(f"--- a/{file.filename}")
        diff_lines.append(f"+++ b/{file.filename}")
        if file.patch:
            diff_lines.append(file.patch)
        else:
            diff_lines.append("Binary file or too large to show patch")
        diff_lines.append("") # empty line separator
        
    return "\n".join(diff_lines)

def post_pr_comment(installation_id: int, repo_name: str, pr_number: int, body: str) -> None:
    """Posts an aggregated review comment to a Pull Request."""
    client = get_installation_client(installation_id)
    repo = client.get_repo(repo_name)
    pr = repo.get_pull(pr_number)
    
    # We use create_issue_comment because PRs are technically issues in the GitHub API
    # and this posts a general comment at the bottom of the PR discussion.
    pr.create_issue_comment(body)
