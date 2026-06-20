import logging
import uuid
import httpx
from app.core.config import settings

logger = logging.getLogger("repohawk.email")


async def send_email(
    to: str,
    subject: str,
    html: str = "",
    unique_subject: bool = False,
    template: dict = None,
) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning(f"No RESEND_API_KEY set. Would send email to {to}: {subject}")
        return False
    msg_id = f"<{uuid.uuid4()}@repohawk.app>"
    if unique_subject:
        subject = f"{subject} [{uuid.uuid4().hex[:6]}]"
    
    payload = {
        "from": "RepoHawk <noreply@repohawk.app>",
        "to": [to],
        "subject": subject,
        "headers": {
            "Message-ID": msg_id,
        },
    }
    if template:
        payload["template"] = template
    else:
        payload["html"] = html

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json=payload,
            )
            if r.is_error:
                logger.error(f"Failed to send email: {r.status_code} {r.text}")
                return False
            return True
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False


def _email_wrapper(body_html: str, logo_url: str = "", hero_image_url: str = "") -> str:
    """Wrap email body in a consistent, premium branded layout."""
    if not logo_url:
        logo_url = f"{settings.FRONTEND_URL}/images/Logo.png"

    # Hero image section — only rendered if a URL is provided
    hero_section = ""
    if hero_image_url:
        hero_section = f"""\
          <!-- Hero Image -->
          <tr>
            <td align="center" style="padding:0 24px 8px;">
              <img src="{hero_image_url}" alt="Welcome to RepoHawk"
                   width="552" style="display:block;margin:0 auto;width:100%;max-width:552px;height:auto;border-radius:12px;border:0;" />
            </td>
          </tr>"""

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RepoHawk</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding:32px 24px 16px;">
              <img src="{logo_url}" alt="RepoHawk" width="200"
                   style="display:block;margin:0 auto;width:200px;height:auto;border:0;" />
            </td>
          </tr>

{hero_section}

          <!-- Body Content -->
          <tr>
            <td style="padding:24px 40px 32px;">
              {body_html}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;" align="center">
              <div style="height:1px;background-color:#e4e4e7;margin:0 auto;width:100%;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa;line-height:1.5;text-align:center;">
                &copy; 2026 RepoHawk &middot; AI-Powered Code Intelligence
              </p>
              <p style="margin:0;font-size:11px;color:#d4d4d8;line-height:1.5;text-align:center;">
                You received this email because you signed up for RepoHawk.<br>
                If this wasn't you, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def send_password_reset_email(email: str, reset_url: str) -> bool:
    logo_url = f"{settings.FRONTEND_URL}/images/Logo.png"

    if settings.RESEND_PASSWORD_RESET_TEMPLATE_ID:
        # Use published template ID from dashboard
        template_payload = {
            "id": settings.RESEND_PASSWORD_RESET_TEMPLATE_ID,
            "variables": {
                "reset_url": reset_url,
                "logo_url": logo_url,
            }
        }
        return await send_email(
            email,
            "Reset your RepoHawk password",
            template=template_payload,
        )

    body = f"""\
<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#18181b;">Reset Your Password</h2>
<p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.7;">
  We received a request to reset the password for your RepoHawk account.
  Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#4a50c5,#00b08a);">
      <a href="{reset_url}" target="_blank"
         style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
        Reset Password &rarr;
      </a>
    </td>
  </tr>
</table>
<p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.6;">
  Or copy and paste this link into your browser:
</p>
<p style="margin:0;font-size:12px;color:#4a50c5;word-break:break-all;line-height:1.5;">
  <a href="{reset_url}" style="color:#4a50c5;text-decoration:underline;">{reset_url}</a>
</p>
<p style="margin:20px 0 0;font-size:13px;color:#a1a1aa;line-height:1.5;">
  If you didn't request a password reset, you can safely ignore this email.
  Your password will remain unchanged.
</p>"""

    return await send_email(
        email,
        "Reset your RepoHawk password",
        _email_wrapper(body, logo_url=logo_url),
    )


async def send_welcome_email(email: str, name: str) -> bool:
    display_name = name if name else "there"
    login_url = f"{settings.FRONTEND_URL}/auth/login"
    logo_url = f"{settings.FRONTEND_URL}/images/Logo.png"
    hero_url = f"{settings.FRONTEND_URL}/images/sigup.png"

    if settings.RESEND_WELCOME_TEMPLATE_ID:
        # Use published template ID from dashboard
        template_payload = {
            "id": settings.RESEND_WELCOME_TEMPLATE_ID,
            "variables": {
                "display_name": display_name,
                "login_url": login_url,
                "logo_url": logo_url,
                "hero_image_url": hero_url,
            }
        }
        return await send_email(
            email,
            "Welcome to RepoHawk 🚀",
            template=template_payload,
        )

    body = f"""\
<h2 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#18181b;">Welcome to RepoHawk!</h2>
<p style="margin:0 0 20px;font-size:15px;color:#71717a;">Your codebase intelligence platform</p>

<p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.7;">
  Hi <strong>{display_name}</strong>,
</p>
<p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.7;">
  Thanks for signing up. Your account is ready, and you can start exploring
  your repositories right away.
</p>
<p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.7;">
  RepoHawk uses AI to analyze your codebase architecture, answer questions
  about your code, and help you navigate complex projects effortlessly.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#4a50c5,#00b08a);">
      <a href="{login_url}" target="_blank"
         style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
        Get Started &rarr;
      </a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.7;">
  Happy coding,<br>
  <strong style="color:#18181b;">The RepoHawk Team</strong>
</p>"""

    return await send_email(
        email,
        "Welcome to RepoHawk 🚀",
        _email_wrapper(body, logo_url=logo_url, hero_image_url=hero_url),
    )
