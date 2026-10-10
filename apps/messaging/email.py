import logging
from smtplib import SMTPException

from django.conf import settings
from django.core.mail import EmailMessage
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)


def enviar_email_notificacao(*, notification_id):
    with transaction.atomic():
        notificacao = (
            Notification.objects.select_for_update()
            .select_related("recipient", "actor")
            .filter(pk=notification_id)
            .first()
        )
        if notificacao is None:
            logger.error(
                "Cannot deliver email for missing notification id=%s.",
                notification_id,
            )
            return False
        if not settings.EMAIL_NOTIFICATIONS_ENABLED:
            notificacao.email_status = Notification.EmailStatus.FAILED
            notificacao.email_error = "O envio de notificações por email está desativado."
            notificacao.save(update_fields=("email_status", "email_error"))
            return False
        if notificacao.email_status == Notification.EmailStatus.SENT:
            return True
        if notificacao.email_status == Notification.EmailStatus.SENDING:
            return False
        notificacao.email_status = Notification.EmailStatus.SENDING
        notificacao.email_error = ""
        notificacao.save(update_fields=("email_status", "email_error"))

    actor_name = (
        notificacao.actor.get_full_name().strip()
        if notificacao.actor is not None
        and hasattr(notificacao.actor, "get_full_name")
        else ""
    )
    if not actor_name:
        actor_name = "Um participante da conversa"
    body = (
        f"{actor_name} enviou uma mensagem numa conversa da Conect Services.\n\n"
        f"{notificacao.body}\n"
    )
    if settings.WEB_APP_URL:
        body += f"\nAcede à tua conta: {settings.WEB_APP_URL}\n"

    correio_eletronico = EmailMessage(
        subject=notificacao.title,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL or None,
        to=(notificacao.recipient.email,),
    )
    try:
        sent_count = correio_eletronico.send(fail_silently=False)
        if sent_count != 1:
            raise SMTPException("O backend de email não confirmou o envio.")
    except (SMTPException, OSError, ImproperlyConfigured):
        Notification.objects.filter(pk=notification_id).update(
            email_status=Notification.EmailStatus.FAILED,
            email_error="Falha no envio; consulta os logs do servidor.",
        )
        logger.exception(
            "Notification email delivery failed for notification id=%s.",
            notification_id,
        )
        return False

    Notification.objects.filter(pk=notification_id).update(
        email_status=Notification.EmailStatus.SENT,
        email_sent_at=timezone.now(),
        email_error="",
    )
    return True
