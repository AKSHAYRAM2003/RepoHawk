import logging
import uuid
import httpx
from app.core.config import settings

logger = logging.getLogger("repohawk.email")


async def send_email(to: str, subject: str, html: str, unique_subject: bool = False) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning(f"No RESEND_API_KEY set. Would send email to {to}: {subject}")
        return False
    msg_id = f"<{uuid.uuid4()}@repohawk.app>"
    if unique_subject:
        subject = f"{subject} [{uuid.uuid4().hex[:6]}]"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": "RepoHawk <noreply@repohawk.app>",
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "headers": {
                        "Message-ID": msg_id,
                    },
                },
            )
            if r.is_error:
                logger.error(f"Failed to send email: {r.status_code} {r.text}")
                return False
            return True
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False


async def send_password_reset_email(email: str, reset_url: str) -> bool:
    html = f"""
    <h2>Reset your RepoHawk password</h2>
    <p>Click the link below to reset your password. This link expires in 1 hour.</p>
    <p><a href="{reset_url}">{reset_url}</a></p>
    <p>If you didn't request this, ignore this email.</p>
    """
    return await send_email(email, "Reset your RepoHawk password", html, unique_subject=True)


async def send_welcome_email(email: str, name: str) -> bool:
    html = f"""
    <h2>Welcome to RepoHawk!</h2>
    <p>Hi {name},</p>
    <p>Your account has been created. Start analyzing your codebases today.</p>
    """
    return await send_email(email, "Welcome to RepoHawk", html)
