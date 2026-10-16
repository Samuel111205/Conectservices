from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMessage
from django.core import signing
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def enviar_verificacao_email(self, user_id):
    user = get_user_model().objects.filter(pk=user_id, email_verified=False).first()
    if user is None:
        return False
    token = signing.dumps(
        {"user_id": user.pk, "email": user.email},
        salt="accounts.email-verification",
    )
    link = f"{settings.WEB_APP_URL}/confirmar-email?token={token}"
    mensagem = EmailMessage(
        subject="Confirma o teu email — Conect Services",
        body=f"Abre esta ligação nas próximas 24 horas para ativar a conta:\n\n{link}\n",
        from_email=settings.DEFAULT_FROM_EMAIL or None,
        to=(user.email,),
    )
    try:
        if mensagem.send(fail_silently=False) != 1:
            raise RuntimeError("O backend de email não confirmou o envio.")
    except Exception as exc:
        raise self.retry(exc=exc) from exc
    return True


@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def enviar_recuperacao_password(self, user_id):
    user = get_user_model().objects.filter(
        pk=user_id, is_active=True, email_verified=True
    ).first()
    if user is None:
        return False
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.WEB_APP_URL}/redefinir-palavra-passe?uid={uid}&token={token}"
    mensagem = EmailMessage(
        subject="Recupera o acesso — Conect Services",
        body=f"Se pediste para alterar a palavra-passe, abre esta ligação:\n\n{link}\n\nSe não foste tu, ignora esta mensagem.",
        from_email=settings.DEFAULT_FROM_EMAIL or None,
        to=(user.email,),
    )
    try:
        if mensagem.send(fail_silently=False) != 1:
            raise RuntimeError("O backend de email não confirmou o envio.")
    except Exception as exc:
        raise self.retry(exc=exc) from exc
    return True
