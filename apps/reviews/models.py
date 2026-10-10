from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models

from apps.bookings.models import Booking


class Review(models.Model):
    booking = models.OneToOneField(
        Booking,
        on_delete=models.PROTECT,
        related_name="review",
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
        ]
        indexes = [
            models.Index(
                fields=("rating", "-created_at"),
                name="review_rating_date_idx",
            ),
        ]

    def __str__(self):
        return f"Avaliação #{self.pk} — contratação #{self.booking_id}"
