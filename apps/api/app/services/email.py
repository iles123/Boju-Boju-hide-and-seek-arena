import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    async def send(self, to_email: str, subject: str, body: str) -> None:
        provider = settings.email_provider.lower()
        if provider == "console":
            logger.info("[EMAIL:console] to=%s subject=%s\n%s", to_email, subject, body)
            print(f"\n--- EMAIL ({settings.email_from} -> {to_email}) ---\nSubject: {subject}\n{body}\n--- END EMAIL ---\n")
            return
        # Placeholders for prod providers (Resend/SMTP) - implemented in later hardening if needed.
        logger.warning("Email provider '%s' not implemented; falling back to console.", provider)
        logger.info("[EMAIL:fallback] to=%s subject=%s\n%s", to_email, subject, body)


email_service = EmailService()
