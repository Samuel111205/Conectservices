from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.bookings.models import Booking

from .models import Review


@transaction.atomic
def criar_avaliacao(*, booking_id, actor, rating, comment=""):
    contratacao = Booking.objects.select_for_update().filter(pk=booking_id).first()
    if contratacao is None:
        raise ValidationError({"booking_id": "A contratação indicada não existe."})
    if contratacao.client_id != actor.pk:
        raise PermissionDenied(
            {"booking_id": "Só o cliente da contratação pode avaliá-la."}
        )
    if contratacao.status != Booking.Status.COMPLETED:
        raise ValidationError(
            {"booking_id": "Só é possível avaliar uma contratação concluída."}
        )

    try:
        with transaction.atomic():
            return Review.objects.create(
                booking=contratacao,
                rating=rating,
                comment=comment,
            )
    except IntegrityError as exc:
        if Review.objects.filter(booking=contratacao).exists():
            raise ValidationError(
                {"booking_id": "Esta contratação já foi avaliada."}
            ) from exc
        raise
