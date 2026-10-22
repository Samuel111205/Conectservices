from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.bookings.models import Booking
from apps.commerce.models import ProductOrder

from .models import Review


@transaction.atomic
def criar_avaliacao(
    *, actor, rating, comment="", booking_id=None, product_order_id=None
):
    if (booking_id is None) == (product_order_id is None):
        raise ValidationError(
            "Indica uma contratação concluída ou uma encomenda concluída para avaliar."
        )

    if booking_id is not None:
        contratacao = (
            Booking.objects.select_for_update().filter(pk=booking_id).first()
        )
        if contratacao is None:
            raise ValidationError(
                {"booking_id": "A contratação indicada não existe."}
            )
        if contratacao.client_id != actor.pk:
            raise PermissionDenied(
                {"booking_id": "Só o cliente da contratação pode avaliá-la."}
            )
        if contratacao.status != Booking.Status.COMPLETED:
            raise ValidationError(
                {"booking_id": "Só é possível avaliar uma contratação concluída."}
            )
        target_filter = {"booking": contratacao}
        target_message = "Esta contratação já foi avaliada."
    else:
        encomenda = (
            ProductOrder.objects.select_for_update()
            .filter(pk=product_order_id)
            .first()
        )
        if encomenda is None:
            raise ValidationError(
                {"product_order_id": "A encomenda indicada não existe."}
            )
        if encomenda.buyer_id != actor.pk:
            raise PermissionDenied(
                {"product_order_id": "Só o cliente da encomenda pode avaliá-la."}
            )
        if encomenda.status != ProductOrder.Status.COMPLETED:
            raise ValidationError(
                {"product_order_id": "Só é possível avaliar uma encomenda concluída."}
            )
        target_filter = {"product_order": encomenda}
        target_message = "Esta encomenda já foi avaliada."

    try:
        with transaction.atomic():
            return Review.objects.create(
                **target_filter,
                rating=rating,
                comment=comment,
            )
    except IntegrityError as exc:
        if Review.objects.filter(**target_filter).exists():
            field_name = "booking_id" if booking_id is not None else "product_order_id"
            raise ValidationError({field_name: target_message}) from exc
        raise
