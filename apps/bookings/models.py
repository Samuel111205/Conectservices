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
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_bookings",
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)

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


class Dispute(models.Model):
    class Category(models.TextChoices):
        SERVICE_NOT_DELIVERED = "SERVICE_NOT_DELIVERED", "Serviço não prestado"
        LATE_OR_NO_SHOW = "LATE_OR_NO_SHOW", "Atraso ou falta de comparência"
        QUALITY = "QUALITY", "Qualidade do serviço"
        SCOPE_OR_PRICE = "SCOPE_OR_PRICE", "Âmbito ou preço"
        INTERRUPTION = "INTERRUPTION", "Interrupção do serviço"
        REFUND = "REFUND", "Reembolso"
        OTHER = "OTHER", "Outro"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Aberta"
        UNDER_REVIEW = "UNDER_REVIEW", "Em análise"
        RESOLVED = "RESOLVED", "Resolvida"
        CLOSED = "CLOSED", "Fechada"

    booking = models.ForeignKey(
        Booking,
        on_delete=models.PROTECT,
        related_name="disputes",
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="opened_disputes",
    )
    category = models.CharField(max_length=24, choices=Category.choices)
    description = models.TextField()
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    resolution = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_disputes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-pk")
        verbose_name = "disputa"
        verbose_name_plural = "disputas"
        constraints = [
            models.UniqueConstraint(
                fields=("booking",),
                condition=models.Q(status__in=("OPEN", "UNDER_REVIEW")),
                name="dispute_one_active_per_booking",
            ),
        ]
        indexes = [
            models.Index(fields=("status", "-created_at"), name="dispute_status_date_idx"),
        ]

    def __str__(self):
        return f"Disputa #{self.pk} — contratação #{self.booking_id}"


class DisputeMessage(models.Model):
    dispute = models.ForeignKey(
        Dispute,
        on_delete=models.PROTECT,
        related_name="messages",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="dispute_messages",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "pk")
        verbose_name = "mensagem de disputa"
        verbose_name_plural = "mensagens de disputa"

    def __str__(self):
        return f"Mensagem #{self.pk} — disputa #{self.dispute_id}"


class DisputeStatusEvent(models.Model):
    dispute = models.ForeignKey(
        Dispute,
        on_delete=models.PROTECT,
        related_name="status_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispute_status_events",
    )
    previous_status = models.CharField(max_length=16, blank=True)
    new_status = models.CharField(max_length=16, choices=Dispute.Status.choices)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "pk")
        verbose_name = "evento de estado de disputa"
        verbose_name_plural = "eventos de estado de disputa"

    def __str__(self):
        return f"Disputa #{self.dispute_id}: {self.previous_status or '—'} → {self.new_status}"
