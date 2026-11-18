from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.bookings.models import Booking


class Payment(models.Model):
    class Method(models.TextChoices):
        BANK_TRANSFER = "BANK_TRANSFER", "Transferência bancária"
        CASH = "CASH", "Dinheiro"
        MULTICAIXA = "MULTICAIXA", "Multicaixa"
        MOBILE_MONEY = "MOBILE_MONEY", "Carteira móvel"
        OTHER = "OTHER", "Outro"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente de confirmação"
        CONFIRMED = "CONFIRMED", "Confirmado"
        REJECTED = "REJECTED", "Rejeitado"

    booking = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.01")),),
    )
    currency = models.CharField(max_length=3, default="AOA")
    method = models.CharField(max_length=20, choices=Method.choices)
    external_reference = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "pagamento"
        verbose_name_plural = "pagamentos"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="payment_amount_positive",
            ),
            models.UniqueConstraint(
                fields=("booking",),
                condition=models.Q(status="PENDING"),
                name="payment_one_pending_per_booking",
            ),
            models.UniqueConstraint(
                fields=("booking",),
                condition=models.Q(status="CONFIRMED"),
                name="payment_one_confirmed_per_booking",
            ),
        ]
        indexes = [
            models.Index(
                fields=("booking", "status", "-created_at"),
                name="payment_booking_status_idx",
            ),
        ]

    def __str__(self):
        return f"Pagamento #{self.pk} — contratação #{self.booking_id}"


class PaymentAuditEvent(models.Model):
    """Immutable history of payment registration and administrative review."""

    payment = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        related_name="audit_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_audit_events",
    )
    previous_status = models.CharField(max_length=12, blank=True)
    new_status = models.CharField(max_length=12, choices=Payment.Status.choices)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at", "-pk")
        verbose_name = "evento de auditoria de pagamento"
        verbose_name_plural = "eventos de auditoria de pagamento"

    def __str__(self):
        return (
            f"Pagamento #{self.payment_id}: "
            f"{self.previous_status or '—'} → {self.new_status}"
        )
