import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from typing import Optional

from flask import current_app


class EmailDeliveryError(RuntimeError):
    """Raised when a configured transactional email cannot be delivered."""


def _config_bool(key: str, default: bool = False) -> bool:
    value = current_app.config.get(key, default)
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _config_int(key: str, default: int) -> int:
    value = current_app.config.get(key, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _sender_address() -> str:
    address = (
        current_app.config.get("MAIL_DEFAULT_SENDER")
        or current_app.config.get("SMTP_USERNAME")
        or ""
    ).strip()
    if not address:
        return ""

    sender_name = (current_app.config.get("MAIL_SENDER_NAME") or "").strip()
    return formataddr((sender_name, address)) if sender_name else address


def _record_outbox_email(*, to_email: str, subject: str, text_body: str, html_body: Optional[str]) -> None:
    outbox = current_app.extensions.setdefault("mail_outbox", [])
    outbox.append(
        {
            "to": to_email,
            "subject": subject,
            "text_body": text_body,
            "html_body": html_body,
        }
    )


def send_transactional_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
) -> None:
    if current_app.testing or _config_bool("MAIL_SUPPRESS_SEND"):
        _record_outbox_email(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        return

    smtp_host = (current_app.config.get("SMTP_HOST") or "").strip()
    sender = _sender_address()
    if not smtp_host or not sender:
        message = "SMTP_HOST and MAIL_DEFAULT_SENDER or SMTP_USERNAME are required for email delivery."
        if (current_app.config.get("APP_ENV") or "").strip().lower() == "production":
            raise EmailDeliveryError(message)
        current_app.logger.warning("%s Email was not sent.", message)
        return

    use_ssl = _config_bool("SMTP_USE_SSL")
    use_tls = _config_bool("SMTP_USE_TLS", True)
    port = _config_int("SMTP_PORT", 465 if use_ssl else 587)
    timeout = _config_int("SMTP_TIMEOUT", 10)
    username = (current_app.config.get("SMTP_USERNAME") or "").strip()
    password = current_app.config.get("SMTP_PASSWORD") or ""

    message = EmailMessage()
    message["To"] = to_email
    message["From"] = sender
    message["Subject"] = subject
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, port, timeout=timeout) as smtp:
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
            return

        with smtplib.SMTP(smtp_host, port, timeout=timeout) as smtp:
            if use_tls:
                smtp.starttls(context=ssl.create_default_context())
            if username:
                smtp.login(username, password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("Unable to send email through the configured SMTP server.") from exc


def send_password_reset_email(*, to_email: str, reset_link: str, expires_minutes: int) -> None:
    subject = current_app.config.get("PASSWORD_RESET_EMAIL_SUBJECT") or "Reset your eWaste Hub password"
    safe_link = escape(reset_link, quote=True)
    text_body = (
        "Hello,\n\n"
        "We received a request to reset the password for your eWaste Hub account.\n\n"
        f"Open this secure link to set a new password:\n{reset_link}\n\n"
        f"This link expires in {expires_minutes} minutes and can only be used once.\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "eWaste Hub"
    )
    html_body = (
        "<p>Hello,</p>"
        "<p>We received a request to reset the password for your eWaste Hub account.</p>"
        f'<p><a href="{safe_link}">Set a new password</a></p>'
        f"<p>This link expires in {expires_minutes} minutes and can only be used once.</p>"
        "<p>If you did not request this, you can ignore this email.</p>"
        "<p>eWaste Hub</p>"
    )
    send_transactional_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
