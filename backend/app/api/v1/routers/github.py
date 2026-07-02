import hmac
import hashlib
import os
import logging
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks, status
from typing import Any, Dict, Optional

from app.services.github_app import get_pr_diff, post_pr_comment
from app.services.pr_analysis import analyze_pr_diff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/github", tags=["github"])

def verify_signature(payload_body: bytes, signature_header: Optional[str]) -> bool:
    """Verify that the payload was sent from GitHub."""
    secret = os.getenv("GITHUB_WEBHOOK_SECRET")
    if not secret:
        # If no secret is configured, bypass (not recommended for production)
        logger.warning("GITHUB_WEBHOOK_SECRET not set, bypassing signature verification")
        return True

    if not signature_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="x-hub-signature-256 header is missing!")

    hash_object = hmac.new(secret.encode("utf-8"), msg=payload_body, digestmod=hashlib.sha256)
    expected_signature = "sha256=" + hash_object.hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Request signatures didn't match!")
    
    return True


def handle_pull_request_event(payload: Dict[str, Any]):
    """Background task to analyze PR diffs."""
    action = payload.get("action")
    if action not in ["opened", "synchronize"]:
        logger.info(f"Ignoring pull_request action: {action}")
        return

    try:
        installation_id = payload.get("installation", {}).get("id")
        if not installation_id:
            logger.error("No installation_id found in webhook payload")
            return

        pr_number = payload.get("pull_request", {}).get("number")
        repo_name = payload.get("repository", {}).get("full_name")

        if not pr_number or not repo_name:
            logger.error("Missing pr_number or repo_name in webhook payload")
            return

        logger.info(f"Analyzing PR #{pr_number} for {repo_name} (installation: {installation_id})")

        # 1. Fetch Diff
        diff = get_pr_diff(installation_id, repo_name, pr_number)
        
        # 2. Analyze Diff
        review_comment = analyze_pr_diff(diff)
        
        # 3. Post Comment
        header = f"### 🤖 RepoHawk PR Analysis\n\n"
        post_pr_comment(installation_id, repo_name, pr_number, header + review_comment)
        
        logger.info(f"Successfully posted review for PR #{pr_number} on {repo_name}")
    except Exception as e:
        logger.error(f"Error handling pull_request event: {e}", exc_info=True)


@router.post("/webhook")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: Optional[str] = Header(default=None),
    x_hub_signature_256: Optional[str] = Header(default=None)
):
    """Handles incoming GitHub webhooks."""
    if not x_github_event:
        raise HTTPException(status_code=400, detail="Missing X-GitHub-Event header")

    # Read body for signature verification
    payload_body = await request.body()
    verify_signature(payload_body, x_hub_signature_256)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if x_github_event == "pull_request":
        # Process in the background to return 200 OK to GitHub immediately
        background_tasks.add_task(handle_pull_request_event, payload)
        return {"status": "accepted", "event": "pull_request"}
    
    if x_github_event == "ping":
        return {"status": "pong"}

    return {"status": "ignored", "event": x_github_event}
