from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models

from apps.bookings.models import Booking
from apps.commerce.models import ProductOrder


class Review(models.Model):
    booking = models.OneToOneField(
        Booking,
        on_delete=models.PROTECT,
        related_name="review",
        null=True,
        blank=True,
    )
    product_order = models.OneToOneField(
        ProductOrder,
        on_delete=models.PROTECT,
        related_name="review",
        null=True,
        blank=True,
    )
    rating = models.PositiveSmallIntegerField(
        validators=(MinValueValidator(1), MaxValueValidator(5)),
    )
    comment = models.TextField(
        blank=True,
        validators=(MaxLengthValidator(2000),),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "avaliação"
        verbose_name_plural = "avaliações"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(rating__gte=1, rating__lte=5),
                name="review_rating_between_1_5",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(booking__isnull=False, product_order__isnull=True)
                    | models.Q(booking__isnull=True, product_order__isnull=False)
                ),
                name="review_exactly_one_target",
            ),
        ]
        indexes = [
            models.Index(
                fields=("rating", "-created_at"),
                name="review_rating_date_idx",
            ),
        ]

    def __str__(self):
        target = (
            f"contratação #{self.booking_id}"
            if self.booking_id is not None
            else f"encomenda #{self.product_order_id}"
        )
        return f"Avaliação #{self.pk} — {target}"
