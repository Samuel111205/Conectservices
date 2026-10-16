from django.db import IntegrityError, transaction
from django.utils import timezone
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal

from .models import Conversation, Message, Notification, PushDeviceToken
from .email import enviar_email_notificacao

logger = logging.getLogger(__name__)


def _e_participante(proposal, user):
    return (
        proposal.order.client_id == user.pk
        or proposal.provider.user_id == user.pk
    )


def _pode_enviar(proposal):
    return (
        proposal.status
        in (Proposal.Status.PENDING, Proposal.Status.ACCEPTED)
        and proposal.order.status
        != ServiceOrder.Status.CANCELLED
    )


@transaction.atomic
def abrir_conversa(*, proposal_id, actor):
    proposta = (
        Proposal.objects.select_related("order", "provider__user")
        .filter(pk=proposal_id)
        .first()
    )
    if proposta is None:
        raise ValidationError({"proposal_id": "A proposta indicada não existe."})
    if not _e_participante(proposta, actor):
        raise PermissionDenied("Só os participantes da proposta podem abrir a conversa.")

    existing = Conversation.objects.filter(proposal=proposta).first()
    if existing is not None:
        return existing, False
    if not _pode_enviar(proposta):
        raise ValidationError(
            {"proposal_id": "Não é possível iniciar uma conversa para esta proposta."}
        )

    try:
        with transaction.atomic():
            conversa = Conversation.objects.create(proposal=proposta)
    except IntegrityError as exc:
        conversa = Conversation.objects.filter(proposal=proposta).first()
        if conversa is None:
            raise exc
        return conversa, False
    return conversa, True


@transaction.atomic
def enviar_mensagem(*, conversation_id, actor, body):
    conversa = (
        Conversation.objects.select_for_update()
        .select_related("proposal__order", "proposal__provider__user")
        .filter(pk=conversation_id)
        .first()
    )
    if conversa is None:
        raise ValidationError({"conversation_id": "A conversa indicada não existe."})
    proposta = conversa.proposal
    if not _e_participante(proposta, actor):
        raise PermissionDenied("Só os participantes podem enviar mensagens.")
    if not _pode_enviar(proposta):
        raise ValidationError("Esta conversa já não aceita novas mensagens.")

    mensagem = Message.objects.create(
        conversation=conversa,
        sender=actor,
        body=body,
    )
    conversa.updated_at = mensagem.created_at
    conversa.save(update_fields=("updated_at",))
    recipient_id = (
        proposta.provider.user_id
        if actor.pk == proposta.order.client_id
        else proposta.order.client_id
    )
    notificacao = Notification.objects.create(
        recipient_id=recipient_id,
        actor=actor,
        conversation=conversa,
        message=mensagem,
        kind=Notification.Kind.MESSAGE,
        title="Nova mensagem",
        body=body[:500],
    )
    from .tasks import entregar_email_notificacao, entregar_push_notificacao

    transaction.on_commit(
        lambda: entregar_email_notificacao.delay(notificacao.pk), robust=True
    )
    transaction.on_commit(
        lambda: entregar_push_notificacao.delay(notificacao.pk), robust=True
    )
    return mensagem


def registar_dispositivo_push(*, user, token, platform):
    dispositivo, _ = PushDeviceToken.objects.update_or_create(
        token=token,
        defaults={"user": user, "platform": platform, "is_active": True},
    )
    return dispositivo


def desativar_dispositivo_push(*, user, token):
    return PushDeviceToken.objects.filter(
        user=user,
        token=token,
        is_active=True,
    ).update(is_active=False)


def enviar_push_notification(*, notification_id):
    if not settings.PUSH_NOTIFICATIONS_ENABLED:
        return False

    notificacao = Notification.objects.filter(pk=notification_id).first()
    if notificacao is None:
        return False

    devices = list(
        PushDeviceToken.objects.filter(
            user_id=notificacao.recipient_id,
            is_active=True,
        )
    )
    if not devices:
        return False

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    access_token = settings.EXPO_ACCESS_TOKEN
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    messages = [
        {
            "to": device.token,
            "title": notificacao.title,
            "body": "Tens uma nova mensagem sobre um serviço.",
            "data": {
                "notificationId": notificacao.pk,
                "conversationId": notificacao.conversation_id,
            },
            "sound": "default",
            "priority": "high",
        }
        for device in devices
    ]
    request = Request(
        "https://exp.host/--/api/v2/push/send",
        data=json.dumps(messages).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        logger.exception("Expo push delivery failed for notification id=%s", notification_id)
        return False

    tickets = payload.get("data", [])
    if isinstance(tickets, dict):
        tickets = [tickets]
    for device, ticket in zip(devices, tickets):
        details = ticket.get("details") or {}
        if details.get("error") == "DeviceNotRegistered":
            PushDeviceToken.objects.filter(pk=device.pk).update(is_active=False)
        elif ticket.get("status") == "error":
            logger.warning(
                "Expo push ticket failed for device id=%s: %s",
                device.pk,
                ticket.get("message", "unknown error"),
            )
    return True


def marcar_notificacoes_conversa_como_lidas(*, conversation_id, user):
    return Notification.objects.filter(
        conversation_id=conversation_id,
        recipient=user,
        read_at__isnull=True,
    ).update(read_at=timezone.now())


def marcar_notificacao_como_lida(*, notification, user):
    if notification.recipient_id != user.pk:
        raise PermissionDenied("Só o destinatário pode marcar a notificação como lida.")
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=("read_at",))
    return notification


def marcar_todas_notificacoes_como_lidas(*, user):
    return Notification.objects.filter(
        recipient=user,
        read_at__isnull=True,
    ).update(read_at=timezone.now())
