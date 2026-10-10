from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.bookings.models import Booking

from .models import Payment


@transaction.atomic
def criar_registo_pagamento(*, booking_id, actor, method, external_reference=""):
    contratacao = Booking.objects.select_for_update().filter(pk=booking_id).first()
    if contratacao is None:
        raise ValidationError({"booking_id": "A contratação indicada não existe."})
    if contratacao.client_id != actor.pk:
        raise PermissionDenied(
            {"booking_id": "Só o cliente da contratação pode registar o pagamento."}
        )
    if contratacao.status == Booking.Status.CANCELLED:
        raise ValidationError(
            {"booking_id": "Não é possível registar pagamento numa contratação cancelada."}
        )
    if Payment.objects.filter(
        booking=contratacao,
        status__in=(Payment.Status.PENDING, Payment.Status.CONFIRMED),
    ).exists():
        raise ValidationError(
            {"booking_id": "A contratação já tem um pagamento pendente ou confirmado."}
        )

    try:
        with transaction.atomic():
            return Payment.objects.create(
                booking=contratacao,
                amount=contratacao.final_price,
                currency=contratacao.currency,
                method=method,
                external_reference=external_reference,
            )
    except IntegrityError as exc:
        if Payment.objects.filter(
            booking=contratacao,
            status__in=(Payment.Status.PENDING, Payment.Status.CONFIRMED),
        ).exists():
            raise ValidationError(
                {"booking_id": "A contratação já tem um pagamento pendente ou confirmado."}
            ) from exc
        raise


@transaction.atomic
def avaliar_pagamento(*, payment_id, actor, status):
    payment_reference = Payment.objects.only("booking_id").filter(
        pk=payment_id
    ).first()
    if payment_reference is None:
        raise ValidationError("O pagamento indicado não existe.")
    Booking.objects.select_for_update().get(pk=payment_reference.booking_id)
    pagamento = Payment.objects.select_for_update().get(pk=payment_id)

    if not actor.is_staff:
        raise PermissionDenied("Só um administrador pode rever pagamentos.")
    if status not in (Payment.Status.CONFIRMED, Payment.Status.REJECTED):
        raise ValidationError("Estado de revisão inválido.")
    if pagamento.status != Payment.Status.PENDING:
        raise ValidationError("Só é possível rever pagamentos pendentes.")

    pagamento.status = status
    pagamento.reviewed_by = actor
    pagamento.reviewed_at = timezone.now()
    pagamento.save(update_fields=("status", "reviewed_by", "reviewed_at"))
    return pagamento
