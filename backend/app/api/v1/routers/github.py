import json
import logging
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas import GitHubConnectionStatus, GitHubInstallationResponse, GitHubRepoResponse, UpdateAutoAnalyzeRequest
from app.services import github_service

logger = logging.getLogger("repohawk.routers.github")

router = APIRouter(prefix="/github", tags=["GitHub"])


@router.get("/status", response_model=GitHubConnectionStatus)
async def get_github_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    installation = await github_service.get_installation_for_user(db, current_user.id)
    if not installation:
        return GitHubConnectionStatus(connected=False)
    repos = await github_service.get_installation_repos(db, installation.id)
    return GitHubConnectionStatus(
        connected=True,
        installation=GitHubInstallationResponse(
            id=installation.id,
            installation_id=installation.installation_id,
            account_login=installation.account_login,
            account_type=installation.account_type,
            account_avatar_url=installation.account_avatar_url,
            created_at=installation.created_at,
            repos=[GitHubRepoResponse.model_validate(r) for r in repos],
        ),
    )


@router.put("/repos/auto-analyze")
async def update_auto_analyze(
    payload: UpdateAutoAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gr = await github_service.update_auto_analyze(db, payload.repo_id, payload.auto_analyze, current_user.id)
    if not gr:
        raise HTTPException(status_code=404, detail="Repo not found")
    return GitHubRepoResponse.model_validate(gr)


@router.post("/webhook")
async def github_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")
    event = request.headers.get("x-github-event", "")

    if not github_service.verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"GitHub webhook received: event={event}, action={data.get('action')}")

    if event == "installation":
        action = data.get("action")
        installation_data = data.get("installation", {})
        install_id = installation_data.get("id")
        account = installation_data.get("account", {})
        sender = data.get("sender", {})

        if action in ("created", "new_permissions_accepted"):
            await github_service.handle_installation_created(
                db,
                installation_id=install_id,
                account_login=account.get("login", ""),
                account_type=account.get("type", "User"),
                account_avatar_url=account.get("avatar_url"),
                sender_id=sender.get("id"),
                repos=installation_data.get("repositories", data.get("repositories", [])),
            )
        elif action == "deleted":
            await github_service.handle_installation_deleted(db, install_id)

    elif event == "installation_repositories":
        action = data.get("action")
        installation_data = data.get("installation", {})
        install_id = installation_data.get("id")

        if action == "added":
            await github_service.handle_repositories_added(
                db, install_id, data.get("repositories_added", [])
            )
        elif action == "removed":
            await github_service.handle_repositories_removed(
                db, install_id, data.get("repositories_removed", [])
            )

    elif event == "push":
        installation_data = data.get("installation", {})
        install_id = installation_data.get("id")
        repository = data.get("repository", {})
        await github_service.handle_push_event(
            db,
            installation_id=install_id,
            repo_name=repository.get("name", ""),
            owner=repository.get("owner", {}).get("name", ""),
            ref=data.get("ref", ""),
        )

    elif event == "pull_request":
        action = data.get("action")
        if action in ("opened", "synchronize"):
            installation_data = data.get("installation", {})
            install_id = installation_data.get("id")
            install = await github_service.get_installation_by_install_id(db, install_id)
            if install:
                pr = data.get("pull_request", {})
                repo = data.get("repository", {})
                pr_number = pr.get("number")
                pr_title = pr.get("title", "")
                pr_url = pr.get("html_url", "")
                await github_service._create_notification(
                    db,
                    install.user_id,
                    "pr_opened",
                    f"PR #{pr_number}: {pr_title}",
                    f"New PR in {repo.get('full_name', '')} — architecture review available",
                    pr_url,
                )
                await db.commit()

    return {"status": "ok"}
