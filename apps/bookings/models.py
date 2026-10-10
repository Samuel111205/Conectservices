from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.catalog.models import Service
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider


class Booking(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Agendado"
        CONFIRMED = "CONFIRMED", "Confirmado"
        IN_PROGRESS = "IN_PROGRESS", "Em execução"
        COMPLETED = "COMPLETED", "Concluído"
        CANCELLED = "CANCELLED", "Cancelado"

    order = models.OneToOneField(
        ServiceOrder,
        on_delete=models.PROTECT,
        related_name="booking",
    )
    proposal = models.OneToOneField(
        Proposal,
        on_delete=models.PROTECT,
        related_name="booking",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="client_bookings",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="bookings",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="bookings",
        null=True,
        blank=True,
    )
    final_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.01")),),
    )
    duration_minutes = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=(MinValueValidator(1),),
    )
    currency = models.CharField(max_length=3, default="AOA")
    scheduled_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.SCHEDULED,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "contratação"
        verbose_name_plural = "contratações"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(final_price__gt=0),
                name="booking_final_price_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(duration_minutes__isnull=True)
                    | models.Q(duration_minutes__gte=1, duration_minutes__lte=1440)
                ),
                name="booking_duration_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=("client", "status", "-created_at"),
                name="booking_client_status_date_idx",
            ),
            models.Index(
                fields=("provider", "status", "-created_at"),
                name="book_prov_status_date_idx",
            ),
        ]

    def __str__(self):
        return f"Contratação #{self.pk} — {self.order}"
