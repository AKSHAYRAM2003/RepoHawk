import hashlib
import hmac
import json
import logging
from typing import Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.github import GitHubInstallation, GitHubRepo
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger("repohawk.github")


def verify_webhook_signature(payload: bytes, signature_header: str) -> bool:
    if not settings.GITHUB_WEBHOOK_SECRET:
        logger.warning("GITHUB_WEBHOOK_SECRET not set — skipping webhook verification")
        return True
    expected = "sha256=" + hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


async def get_installation_for_user(db: AsyncSession, user_id) -> Optional[GitHubInstallation]:
    result = await db.execute(
        select(GitHubInstallation).where(GitHubInstallation.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_installation_by_install_id(db: AsyncSession, installation_id: int) -> Optional[GitHubInstallation]:
    result = await db.execute(
        select(GitHubInstallation).where(GitHubInstallation.installation_id == installation_id)
    )
    return result.scalar_one_or_none()


async def handle_installation_created(
    db: AsyncSession,
    installation_id: int,
    account_login: str,
    account_type: str,
    account_avatar_url: Optional[str],
    sender_id: int,
    repos: list[dict],
) -> Optional[GitHubInstallation]:
    result = await db.execute(select(User))
    users = result.scalars().all()
    if not users:
        logger.error("No users found — cannot link GitHub installation")
        return None

    user = users[0]
    if len(users) > 1:
        logger.warning(f"Multiple users ({len(users)}) — linking install to first user")

    existing = await get_installation_by_install_id(db, installation_id)
    if existing:
        existing.account_login = account_login
        existing.account_type = account_type
        existing.account_avatar_url = account_avatar_url
        db.add(existing)
        await db.flush()
        await _sync_repos(db, existing.id, repos)
        await db.commit()
        await db.refresh(existing)
        return existing

    install = GitHubInstallation(
        user_id=user.id,
        installation_id=installation_id,
        account_login=account_login,
        account_type=account_type,
        account_avatar_url=account_avatar_url,
    )
    db.add(install)
    await db.flush()

    await _sync_repos(db, install.id, repos)
    await _create_notification(
        db, user.id, "github_connected",
        f"GitHub connected — {account_login}",
        f"Found {len(repos)} repos from {account_login}. Analyze them from your dashboard.",
        "/dashboard",
    )
    await db.commit()
    await db.refresh(install)
    return install


async def handle_installation_deleted(db: AsyncSession, installation_id: int):
    install = await get_installation_by_install_id(db, installation_id)
    if install:
        await db.delete(install)
        await db.commit()


async def handle_repositories_added(db: AsyncSession, installation_id: int, repos: list[dict]):
    install = await get_installation_by_install_id(db, installation_id)
    if not install:
        return
    existing_ids = set()
    result = await db.execute(
        select(GitHubRepo.github_repo_id).where(GitHubRepo.installation_id == install.id)
    )
    for row in result.all():
        existing_ids.add(row[0])

    new_count = 0
    for repo in repos:
        repo_id = repo.get("id")
        if repo_id in existing_ids:
            continue
        gr = GitHubRepo(
            installation_id=install.id,
            github_repo_id=repo_id,
            owner=repo.get("owner", {}).get("login", ""),
            name=repo.get("name", ""),
            full_name=repo.get("full_name", ""),
            private=repo.get("private", False),
            repo_url=repo.get("html_url", ""),
            default_branch=repo.get("default_branch", "main"),
        )
        db.add(gr)
        new_count += 1

    if new_count > 0:
        await _create_notification(
            db, install.user_id, "repos_added",
            f"{new_count} new repos discovered",
            f"{install.account_login} added {new_count} repos.",
            "/dashboard",
        )
    await db.commit()


async def handle_repositories_removed(db: AsyncSession, installation_id: int, repos: list[dict]):
    install = await get_installation_by_install_id(db, installation_id)
    if not install:
        return
    repo_ids_to_remove = [r.get("id") for r in repos if r.get("id")]
    if repo_ids_to_remove:
        result = await db.execute(
            select(GitHubRepo).where(
                GitHubRepo.installation_id == install.id,
                GitHubRepo.github_repo_id.in_(repo_ids_to_remove),
            )
        )
        for gr in result.scalars().all():
            await db.delete(gr)
        await db.commit()


async def handle_push_event(db: AsyncSession, installation_id: int, repo_name: str, owner: str, ref: str):
    branch = ref.replace("refs/heads/", "") if ref else "main"
    install = await get_installation_by_install_id(db, installation_id)
    if not install:
        return
    result = await db.execute(
        select(GitHubRepo).where(
            GitHubRepo.installation_id == install.id,
            GitHubRepo.owner == owner,
            GitHubRepo.name == repo_name,
        )
    )
    gr = result.scalar_one_or_none()
    if gr and gr.auto_analyze:
        await _create_notification(
            db, install.user_id, "push_detected",
            f"New push to {owner}/{repo_name} ({branch})",
            f"Auto-analysis triggered for {branch}",
            f"/repo/{gr.id}",
        )
        await db.commit()


async def get_installation_repos(db: AsyncSession, installation_id) -> list[GitHubRepo]:
    result = await db.execute(
        select(GitHubRepo).where(GitHubRepo.installation_id == installation_id)
    )
    return list(result.scalars().all())


async def update_auto_analyze(db: AsyncSession, repo_id, auto_analyze: bool, user_id) -> Optional[GitHubRepo]:
    result = await db.execute(
        select(GitHubRepo).join(GitHubInstallation).where(
            GitHubRepo.id == repo_id,
            GitHubInstallation.user_id == user_id,
        )
    )
    gr = result.scalar_one_or_none()
    if gr:
        gr.auto_analyze = auto_analyze
        db.add(gr)
        await db.commit()
        await db.refresh(gr)
    return gr


async def _sync_repos(db: AsyncSession, install_db_id, repos: list[dict]):
    existing = await get_installation_repos(db, install_db_id)
    existing_map = {r.github_repo_id: r for r in existing}
    seen = set()
    for repo in repos:
        repo_id = repo.get("id")
        if not repo_id:
            continue
        seen.add(repo_id)
        if repo_id in existing_map:
            continue
        gr = GitHubRepo(
            installation_id=install_db_id,
            github_repo_id=repo_id,
            owner=repo.get("owner", {}).get("login", ""),
            name=repo.get("name", ""),
            full_name=repo.get("full_name", ""),
            private=repo.get("private", False),
            repo_url=repo.get("html_url", ""),
            default_branch=repo.get("default_branch", "main"),
        )
        db.add(gr)

    for repo_id, gr in existing_map.items():
        if repo_id not in seen:
            await db.delete(gr)
    await db.flush()


async def _create_notification(db: AsyncSession, user_id, notif_type: str, title: str, body: str, link: str):
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notif)
