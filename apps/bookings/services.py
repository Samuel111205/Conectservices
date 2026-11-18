from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider

from .models import Booking, Dispute, DisputeMessage, DisputeStatusEvent


def _get_booking_for_update(*, booking_id, select_related=()):
    try:
        return Booking.objects.select_for_update().select_related(*select_related).get(
            pk=booking_id
        )
    except Booking.DoesNotExist as exc:
        raise NotFound("A contratação indicada não existe.") from exc


@transaction.atomic
def aceitar_proposta(*, proposal_id, actor):
    proposal_reference = Proposal.objects.only("order_id").filter(
        pk=proposal_id
    ).first()
    if proposal_reference is None:
        raise ValidationError("A proposta indicada não existe.")

    pedido = ServiceOrder.objects.select_for_update().get(
        pk=proposal_reference.order_id
    )
    proposta = Proposal.objects.select_for_update().select_related(
        "provider__user",
        "service",
    ).get(pk=proposal_id)

    if pedido.client_id != actor.pk:
        raise PermissionDenied("Só o cliente autor do pedido pode aceitar propostas.")
    if pedido.status not in (
        ServiceOrder.Status.OPEN,
        ServiceOrder.Status.NEGOTIATING,
    ):
        raise ValidationError("Este pedido já não aceita propostas.")
    if proposta.status != Proposal.Status.PENDING:
        raise ValidationError("Só é possível aceitar uma proposta pendente.")
    if (
        proposta.provider.verification_status
        != Provider.VerificationStatus.VERIFIED
        or not proposta.provider.user.is_active
    ):
        raise ValidationError(
            "O prestador já não está autorizado a executar serviços."
        )

    duration_minutes = (
        proposta.service.duration_minutes
        if proposta.service is not None
        else None
    )
    if duration_minutes is None:
        duration_minutes = pedido.requested_duration_minutes
    if duration_minutes is None:
        raise ValidationError(
            "Indica a duração pretendida no pedido ou escolhe um serviço com duração definida."
        )

    contratacao = Booking.objects.create(
        order=pedido,
        proposal=proposta,
        client=actor,
        provider=proposta.provider,
        service=proposta.service,
        final_price=proposta.price,
        currency=proposta.currency,
        duration_minutes=duration_minutes,
    )
    proposta.status = Proposal.Status.ACCEPTED
    proposta.save(update_fields=("status", "updated_at"))
    Proposal.objects.filter(
        order=pedido,
        status=Proposal.Status.PENDING,
    ).exclude(pk=proposta.pk).update(
        status=Proposal.Status.REJECTED,
        updated_at=timezone.now(),
    )
    pedido.status = ServiceOrder.Status.AWARDED
    pedido.save(update_fields=("status", "updated_at"))
    return contratacao


@transaction.atomic
def confirmar_contratacao(*, booking_id, actor):
    contratacao = _get_booking_for_update(
        booking_id=booking_id,
        select_related=("client", "provider__user"),
    )
    if contratacao.client_id != actor.pk:
        raise PermissionDenied("Só o cliente pode confirmar a contratação.")
    if contratacao.status != Booking.Status.SCHEDULED:
        raise ValidationError("Só é possível confirmar uma contratação agendada.")
    if contratacao.scheduled_at is None:
        raise ValidationError("Escolhe primeiro um horário disponível para a contratação.")
    contratacao.status = Booking.Status.CONFIRMED
    contratacao.save(update_fields=("status", "updated_at"))
    return contratacao


@transaction.atomic
def iniciar_contratacao(*, booking_id, actor):
    contratacao = _get_booking_for_update(
        booking_id=booking_id,
        select_related=("provider__user",),
    )
    if contratacao.provider.user_id != actor.pk:
        raise PermissionDenied("Só o prestador contratado pode iniciar o serviço.")
    if not actor.is_active or contratacao.provider.verification_status != Provider.VerificationStatus.VERIFIED:
        raise PermissionDenied("O prestador não está autorizado a executar o serviço.")
    if contratacao.status != Booking.Status.CONFIRMED:
        raise ValidationError("A contratação tem de estar confirmada antes de iniciar.")
    if contratacao.scheduled_at is None:
        raise ValidationError("A contratação tem de ter um horário marcado.")
    contratacao.status = Booking.Status.IN_PROGRESS
    contratacao.save(update_fields=("status", "updated_at"))
    return contratacao


@transaction.atomic
def concluir_contratacao(*, booking_id, actor):
    contratacao = _get_booking_for_update(
        booking_id=booking_id,
        select_related=("order", "client"),
    )
    if contratacao.client_id != actor.pk:
        raise PermissionDenied("Só o cliente pode confirmar a conclusão do serviço.")
    if contratacao.status != Booking.Status.IN_PROGRESS:
        raise ValidationError("Só é possível concluir um serviço em execução.")
    contratacao.status = Booking.Status.COMPLETED
    contratacao.completed_at = timezone.now()
    contratacao.save(update_fields=("status", "completed_at", "updated_at"))
    pedido = contratacao.order
    pedido.status = ServiceOrder.Status.COMPLETED
    pedido.save(update_fields=("status", "updated_at"))
    return contratacao


@transaction.atomic
def cancelar_contratacao(*, booking_id, actor, reason=""):
    contratacao = _get_booking_for_update(
        booking_id=booking_id,
        select_related=("order", "client", "provider__user"),
    )
    participant_ids = (contratacao.client_id, contratacao.provider.user_id)
    if actor.pk not in participant_ids:
        raise PermissionDenied("Só os participantes podem cancelar a contratação.")
    if contratacao.status not in (Booking.Status.SCHEDULED, Booking.Status.CONFIRMED):
        raise ValidationError(
            "A contratação já iniciada ou concluída não pode ser cancelada por esta ação."
        )
    contratacao.status = Booking.Status.CANCELLED
    contratacao.cancellation_reason = reason
    contratacao.cancelled_by = actor
    contratacao.cancelled_at = timezone.now()
    contratacao.save(
        update_fields=(
            "status",
            "cancellation_reason",
            "cancelled_by",
            "cancelled_at",
            "updated_at",
        )
    )
    pedido = contratacao.order
    pedido.status = ServiceOrder.Status.CANCELLED
    pedido.save(update_fields=("status", "updated_at"))
    return contratacao


@transaction.atomic
def abrir_disputa(*, booking_id, actor, category, description):
    contratacao = _get_booking_for_update(
        booking_id=booking_id,
        select_related=("client", "provider__user"),
    )
    if actor.pk not in (contratacao.client_id, contratacao.provider.user_id):
        raise PermissionDenied("Só os participantes podem abrir uma disputa.")
    if Dispute.objects.filter(
        booking=contratacao,
        status__in=(Dispute.Status.OPEN, Dispute.Status.UNDER_REVIEW),
    ).exists():
        raise ValidationError("Esta contratação já tem uma disputa em aberto.")

    disputa = Dispute.objects.create(
        booking=contratacao,
        opened_by=actor,
        category=category,
        description=description,
    )
    DisputeStatusEvent.objects.create(
        dispute=disputa,
        actor=actor,
        previous_status="",
        new_status=disputa.status,
        note="Disputa aberta.",
    )
    from apps.messaging.services import criar_notificacao_de_caso

    destinatario = (
        contratacao.provider.user
        if actor.pk == contratacao.client_id
        else contratacao.client
    )
    criar_notificacao_de_caso(
        recipient=destinatario,
        actor=actor,
        title="Nova disputa",
        body=f"Foi aberta uma disputa sobre a contratação #{contratacao.pk}.",
        dispute=disputa,
    )
    return disputa


@transaction.atomic
def enviar_mensagem_disputa(*, dispute_id, actor, body):
    try:
        disputa = Dispute.objects.select_for_update().select_related(
            "booking__client", "booking__provider__user"
        ).get(pk=dispute_id)
    except Dispute.DoesNotExist as exc:
        raise NotFound("A disputa indicada não existe.") from exc

    participantes = (
        disputa.booking.client_id,
        disputa.booking.provider.user_id,
    )
    if not actor.is_staff and actor.pk not in participantes:
        raise PermissionDenied("Só os participantes e a equipa de apoio podem responder.")
    if disputa.status not in (Dispute.Status.OPEN, Dispute.Status.UNDER_REVIEW):
        raise ValidationError("Esta disputa já não aceita mensagens.")
    mensagem = DisputeMessage.objects.create(
        dispute=disputa,
        author=actor,
        body=body,
    )
    from apps.messaging.services import criar_notificacao_de_caso

    if actor.is_staff:
        destinatarios = (disputa.booking.client, disputa.booking.provider.user)
    elif actor.pk == disputa.booking.client_id:
        destinatarios = (disputa.booking.provider.user,)
    else:
        destinatarios = (disputa.booking.client,)
    for destinatario in destinatarios:
        criar_notificacao_de_caso(
            recipient=destinatario,
            actor=actor,
            title="Nova mensagem na disputa",
            body=f"Há uma nova mensagem na disputa #{disputa.pk}.",
            dispute=disputa,
        )
    return mensagem


@transaction.atomic
def avaliar_disputa(*, dispute_id, actor, status, resolution=""):
    try:
        disputa = Dispute.objects.select_for_update().select_related(
            "booking__client", "booking__provider__user"
        ).get(pk=dispute_id)
    except Dispute.DoesNotExist as exc:
        raise NotFound("A disputa indicada não existe.") from exc

    if not actor.is_staff:
        raise PermissionDenied("Só a equipa de apoio pode alterar o estado da disputa.")
    if status not in (Dispute.Status.UNDER_REVIEW, Dispute.Status.RESOLVED, Dispute.Status.CLOSED):
        raise ValidationError("Estado de análise inválido.")
    if disputa.status not in (Dispute.Status.OPEN, Dispute.Status.UNDER_REVIEW, Dispute.Status.RESOLVED):
        raise ValidationError("Esta disputa já está fechada.")
    if status == Dispute.Status.CLOSED and disputa.status != Dispute.Status.RESOLVED:
        raise ValidationError("Só é possível fechar uma disputa já resolvida.")
    if status == Dispute.Status.RESOLVED and not resolution.strip():
        raise ValidationError({"resolution": "Indica a decisão e a respectiva fundamentação."})

    previous_status = disputa.status
    disputa.status = status
    disputa.reviewed_by = actor
    disputa.resolution = resolution if status == Dispute.Status.RESOLVED else ""
    disputa.resolved_at = (
        timezone.now() if status == Dispute.Status.RESOLVED else None
    )
    disputa.save(
        update_fields=(
            "status",
            "reviewed_by",
            "resolution",
            "resolved_at",
            "updated_at",
        )
    )
    DisputeStatusEvent.objects.create(
        dispute=disputa,
        actor=actor,
        previous_status=previous_status,
        new_status=status,
        note=resolution,
    )
    from apps.messaging.services import criar_notificacao_de_caso

    for destinatario in (disputa.booking.client, disputa.booking.provider.user):
        criar_notificacao_de_caso(
            recipient=destinatario,
            actor=actor,
            title="Actualização da disputa",
            body=f"A disputa #{disputa.pk} está agora: {disputa.get_status_display()}.",
            dispute=disputa,
        )
    return disputa
