from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import ServiceOrder


@transaction.atomic
def cancelar_pedido(*, order_id, actor):
    pedido = ServiceOrder.objects.select_for_update().get(pk=order_id)
    if pedido.client_id != actor.pk:
        raise PermissionDenied("Só o cliente que criou o pedido pode cancelá-lo.")
    if pedido.status not in (
        ServiceOrder.Status.OPEN,
        ServiceOrder.Status.NEGOTIATING,
    ):
        raise ValidationError("Este pedido já não pode ser cancelado.")
    pedido.status = ServiceOrder.Status.CANCELLED
    pedido.save(update_fields=("status", "updated_at"))
    from apps.proposals.models import Proposal

    Proposal.objects.filter(
        order=pedido,
        status=Proposal.Status.PENDING,
    ).update(
        status=Proposal.Status.REJECTED,
        updated_at=timezone.now(),
    )
    return pedido
