from decimal import Decimal

from django.core.validators import MaxLengthValidator, MinValueValidator
from django.db import models

from apps.catalog.models import Service
from apps.orders.models import ServiceOrder
from apps.providers.models import Provider


class Proposal(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        ACCEPTED = "ACCEPTED", "Aceite"
        REJECTED = "REJECTED", "Rejeitada"
        CANCELLED = "CANCELLED", "Cancelada"

    order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.PROTECT,
        related_name="proposals",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="proposals",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="proposals",
        null=True,
        blank=True,
    )
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.01")),),
    )
    currency = models.CharField(max_length=3, default="AOA")
    description = models.TextField(validators=(MaxLengthValidator(3000),))
    estimated_days = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "proposta"
        verbose_name_plural = "propostas"
        constraints = [
            models.UniqueConstraint(
                fields=("order", "provider"),
                name="unique_proposal_per_order_provider",
            ),
            models.CheckConstraint(
                condition=models.Q(price__gt=0),
                name="proposal_price_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(estimated_days__gt=0),
                name="proposal_estimated_days_positive",
            ),
        ]
        indexes = [
            models.Index(
                fields=("order", "status", "-created_at"),
                name="proposal_order_status_date_idx",
            ),
            models.Index(
                fields=("provider", "status", "-created_at"),
                name="prop_prov_status_date_idx",
            ),
        ]

    def __str__(self):
        return f"Proposta #{self.pk} — {self.order}"
