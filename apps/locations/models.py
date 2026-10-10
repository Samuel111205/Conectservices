from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from apps.providers.models import Provider


class Province(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=12, unique=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "província"
        verbose_name_plural = "províncias"

    def __str__(self):
        return self.name


class Municipality(models.Model):
    province = models.ForeignKey(
        Province,
        on_delete=models.PROTECT,
        related_name="municipalities",
    )
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("province__name", "name")
        verbose_name = "município"
        verbose_name_plural = "municípios"
        constraints = [
            models.UniqueConstraint(
                fields=("province", "name"),
                name="unique_municipality_name_per_province",
            ),
        ]
        indexes = [
            models.Index(
                fields=("province", "is_active", "name"),
                name="muni_prov_active_name_idx",
            ),
        ]

    def __str__(self):
        return f"{self.name} — {self.province.name}"


class UserLocation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_locations",
    )
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.PROTECT,
        related_name="user_locations",
    )
    label = models.CharField(max_length=80, blank=True)
    neighborhood = models.CharField(max_length=120, blank=True)
    address = models.CharField(max_length=250, blank=True)
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        validators=(MinValueValidator(-90), MaxValueValidator(90)),
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        validators=(MinValueValidator(-180), MaxValueValidator(180)),
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "id")
        verbose_name = "localização guardada"
        verbose_name_plural = "localizações guardadas"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True, longitude__isnull=True)
                    | Q(latitude__isnull=False, longitude__isnull=False)
                ),
                name="user_location_coordinates_together",
            ),
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True)
                    | Q(latitude__gte=-90, latitude__lte=90)
                ),
                name="user_location_latitude_range",
            ),
            models.CheckConstraint(
                condition=(
                    Q(longitude__isnull=True)
                    | Q(longitude__gte=-180, longitude__lte=180)
                ),
                name="user_location_longitude_range",
            ),
        ]

    def __str__(self):
        return self.label or self.neighborhood or str(self.municipality)


class ProviderCoverage(models.Model):
    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="coverage_areas",
    )
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.PROTECT,
        related_name="provider_coverages",
    )
    radius_km = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        validators=(
            MinValueValidator(Decimal("0")),
            MaxValueValidator(Decimal("9999.99")),
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("municipality__province__name", "municipality__name")
        verbose_name = "área de atendimento"
        verbose_name_plural = "áreas de atendimento"
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "municipality"),
                name="unique_provider_coverage_municipality",
            ),
            models.CheckConstraint(
                condition=Q(radius_km__isnull=True) | Q(radius_km__gte=0),
                name="provider_coverage_radius_nonnegative",
            ),
        ]
        indexes = [
            models.Index(
                fields=("municipality", "provider"),
                name="cover_muni_provider_idx",
            ),
        ]

    def __str__(self):
        return f"{self.provider} — {self.municipality}"


class LocationAuditEvent(models.Model):
    class EntityType(models.TextChoices):
        PROVINCE = "PROVINCE", "Província"
        MUNICIPALITY = "MUNICIPALITY", "Município"

    class Action(models.TextChoices):
        CREATED = "CREATED", "Criado"
        UPDATED = "UPDATED", "Atualizado"
        DEACTIVATED = "DEACTIVATED", "Desativado"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="location_audit_events",
        null=True,
    )
    entity_type = models.CharField(max_length=16, choices=EntityType.choices)
    entity_id_snapshot = models.PositiveBigIntegerField()
    entity_name_snapshot = models.CharField(max_length=120)
    action = models.CharField(max_length=16, choices=Action.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "evento de auditoria de localização"
        verbose_name_plural = "eventos de auditoria de localização"


__all__ = (
    "LocationAuditEvent",
    "Municipality",
    "Province",
    "ProviderCoverage",
    "UserLocation",
)
