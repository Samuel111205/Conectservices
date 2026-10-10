from django.conf import settings
from decimal import Decimal

from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from apps.catalog.models import Category
from apps.locations.models import Municipality


class ServiceOrder(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Aberto"
        NEGOTIATING = "NEGOTIATING", "Em negociação"
        AWARDED = "AWARDED", "Contratado"
        COMPLETED = "COMPLETED", "Concluído"
        CANCELLED = "CANCELLED", "Cancelado"

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="service_orders",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="service_orders",
    )
    title = models.CharField(max_length=160)
    description = models.TextField(validators=(MaxLengthValidator(5000),))
    minimum_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=(MinValueValidator(0),),
    )
    maximum_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=(MinValueValidator(0),),
    )
    requested_duration_minutes = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=(MinValueValidator(1), MaxValueValidator(1440)),
    )
    currency = models.CharField(max_length=3, default="AOA")
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.PROTECT,
        related_name="service_orders",
    )
    municipality_name_snapshot = models.CharField(max_length=120)
    province_name_snapshot = models.CharField(max_length=100)
    neighborhood_snapshot = models.CharField(max_length=120, blank=True)
    address_snapshot = models.CharField(max_length=250, blank=True)
    latitude_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        validators=(
            MinValueValidator(Decimal("-90")),
            MaxValueValidator(Decimal("90")),
        ),
    )
    longitude_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        validators=(
            MinValueValidator(Decimal("-180")),
            MaxValueValidator(Decimal("180")),
        ),
    )
    requested_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "pedido de serviço"
        verbose_name_plural = "pedidos de serviço"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(minimum_budget__isnull=True)
                    | Q(minimum_budget__gte=0)
                ),
                name="order_min_budget_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    Q(maximum_budget__isnull=True)
                    | Q(maximum_budget__gte=0)
                ),
                name="order_max_budget_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    Q(minimum_budget__isnull=True)
                    | Q(maximum_budget__isnull=True)
                    | Q(maximum_budget__gte=F("minimum_budget"))
                ),
                name="order_budget_range_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(requested_duration_minutes__isnull=True)
                    | Q(
                        requested_duration_minutes__gte=1,
                        requested_duration_minutes__lte=1440,
                    )
                ),
                name="order_requested_duration_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(latitude_snapshot__isnull=True, longitude_snapshot__isnull=True)
                    | Q(latitude_snapshot__isnull=False, longitude_snapshot__isnull=False)
                ),
                name="order_coordinates_together",
            ),
            models.CheckConstraint(
                condition=(
                    Q(latitude_snapshot__isnull=True)
                    | Q(latitude_snapshot__gte=-90, latitude_snapshot__lte=90)
                ),
                name="order_latitude_snapshot_range",
            ),
            models.CheckConstraint(
                condition=(
                    Q(longitude_snapshot__isnull=True)
                    | Q(longitude_snapshot__gte=-180, longitude_snapshot__lte=180)
                ),
                name="order_longitude_snapshot_range",
            ),
        ]
        indexes = [
            models.Index(
                fields=("status", "category", "-created_at"),
                name="order_status_category_date_idx",
            ),
            models.Index(
                fields=("client", "status", "-created_at"),
                name="order_client_status_date_idx",
            ),
        ]

    def __str__(self):
        return self.title
