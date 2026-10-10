from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider

from .models import Booking


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
    contratacao = Booking.objects.select_for_update().select_related(
        "client",
        "provider__user",
    ).get(pk=booking_id)
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
    contratacao = Booking.objects.select_for_update().select_related(
        "provider__user",
    ).get(pk=booking_id)
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
    contratacao = Booking.objects.select_for_update().select_related(
        "order",
        "client",
    ).get(pk=booking_id)
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
def cancelar_contratacao(*, booking_id, actor):
    contratacao = Booking.objects.select_for_update().select_related(
        "order",
        "client",
        "provider__user",
    ).get(pk=booking_id)
    participant_ids = (contratacao.client_id, contratacao.provider.user_id)
    if actor.pk not in participant_ids:
        raise PermissionDenied("Só os participantes podem cancelar a contratação.")
    if contratacao.status not in (Booking.Status.SCHEDULED, Booking.Status.CONFIRMED):
        raise ValidationError(
            "A contratação já iniciada ou concluída não pode ser cancelada por esta ação."
        )
    contratacao.status = Booking.Status.CANCELLED
    contratacao.save(update_fields=("status", "updated_at"))
    pedido = contratacao.order
    pedido.status = ServiceOrder.Status.CANCELLED
    pedido.save(update_fields=("status", "updated_at"))
    return contratacao
