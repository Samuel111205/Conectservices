from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.orders.models import ServiceOrder
from apps.providers.models import Provider

from .models import Proposal


@transaction.atomic
def criar_proposta(*, provider, order, **proposal_data):
    order = ServiceOrder.objects.select_for_update().get(pk=order.pk)
    if order.status not in (
        ServiceOrder.Status.OPEN,
        ServiceOrder.Status.NEGOTIATING,
    ):
        raise ValidationError("Este pedido já não aceita propostas.")
    if (
        provider.verification_status != Provider.VerificationStatus.VERIFIED
        or not provider.user.is_active
    ):
        raise ValidationError(
            "Apenas prestadores verificados e ativos podem enviar propostas."
        )
    try:
        with transaction.atomic():
            proposta = Proposal.objects.create(
                provider=provider,
                order=order,
                currency="AOA",
                **proposal_data,
            )
    except IntegrityError as exc:
        if Proposal.objects.filter(order=order, provider=provider).exists():
            raise ValidationError(
                "Já enviaste uma proposta para este pedido."
            ) from exc
        raise

    if order.status == ServiceOrder.Status.OPEN:
        order.status = ServiceOrder.Status.NEGOTIATING
        order.save(update_fields=("status", "updated_at"))
    return proposta


@transaction.atomic
def cancelar_proposta(*, proposal_id, actor):
    proposal_ref = Proposal.objects.only("order_id").filter(pk=proposal_id).first()
    if proposal_ref is None:
        raise ValidationError("A proposta indicada não existe.")
    from apps.orders.models import ServiceOrder

    ServiceOrder.objects.select_for_update().get(pk=proposal_ref.order_id)
    proposta = Proposal.objects.select_for_update().select_related(
        "provider__user",
        "order",
    ).get(pk=proposal_id)
    if proposta.provider.user_id != actor.pk:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Só o prestador autor da proposta pode cancelá-la.")
    if proposta.status != Proposal.Status.PENDING:
        raise ValidationError("Só é possível cancelar uma proposta pendente.")
    proposta.status = Proposal.Status.CANCELLED
    proposta.save(update_fields=("status", "updated_at"))
    return proposta


@transaction.atomic
def rejeitar_proposta(*, proposal_id, actor):
    proposal_ref = Proposal.objects.only("order_id").filter(pk=proposal_id).first()
    if proposal_ref is None:
        raise ValidationError("A proposta indicada não existe.")
    from apps.orders.models import ServiceOrder

    ServiceOrder.objects.select_for_update().get(pk=proposal_ref.order_id)
    proposta = Proposal.objects.select_for_update().select_related("order").get(pk=proposal_id)
    if proposta.order.client_id != actor.pk:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Só o cliente autor do pedido pode rejeitar a proposta.")
    if proposta.status != Proposal.Status.PENDING:
        raise ValidationError("Só é possível rejeitar uma proposta pendente.")
    proposta.status = Proposal.Status.REJECTED
    proposta.save(update_fields=("status", "updated_at"))
    return proposta
