from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from apps.providers.models import Provider


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(
        blank=True,
        validators=(MaxLengthValidator(1000),),
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="children",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "categoria"
        verbose_name_plural = "categorias"

    def clean(self):
        super().clean()
        if self.parent_id and self.pk and self.parent_id == self.pk:
            raise ValidationError(
                {"parent": "Uma categoria não pode ser pai de si própria."}
            )

        ancestor = self.parent
        while ancestor is not None:
            if self.pk and ancestor.pk == self.pk:
                raise ValidationError(
                    {"parent": "A hierarquia criaria uma referência circular."}
                )
            ancestor = ancestor.parent

        if self.is_active and self.parent_id and not self.parent.is_active:
            raise ValidationError(
                {"parent": "Uma categoria ativa deve ter um pai ativo."}
            )

        if (
            self.pk
            and not self.is_active
            and self.children.filter(is_active=True).exists()
        ):
            raise ValidationError(
                {"is_active": "Desative primeiro as subcategorias ativas."}
            )

    def __str__(self):
        return self.name


class Service(models.Model):
    class PriceType(models.TextChoices):
        FIXED = "FIXED", "Fixo"
        STARTING_AT = "STARTING_AT", "A partir de"
        RANGE = "RANGE", "Faixa"
        ON_REQUEST = "ON_REQUEST", "Sob consulta"

    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="services",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="services",
    )
    name = models.CharField(max_length=160)
    description = models.TextField(
        blank=True,
        validators=(MaxLengthValidator(5000),),
    )
    minimum_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=(MinValueValidator(Decimal("0")),),
    )
    maximum_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=(MinValueValidator(Decimal("0")),),
    )
    currency = models.CharField(max_length=3, default="AOA")
    price_type = models.CharField(max_length=16, choices=PriceType.choices)
    duration_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=(MinValueValidator(1), MaxValueValidator(1440)),
    )
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "serviço"
        verbose_name_plural = "serviços"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(minimum_price__isnull=True)
                    | Q(minimum_price__gte=0)
                ),
                name="service_min_price_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    Q(maximum_price__isnull=True)
                    | Q(maximum_price__gte=0)
                ),
                name="service_max_price_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    Q(price_type="FIXED")
                    & Q(minimum_price__isnull=False)
                    & Q(maximum_price=F("minimum_price"))
                )
                | (
                    Q(price_type="STARTING_AT")
                    & Q(minimum_price__isnull=False)
                    & Q(maximum_price__isnull=True)
                )
                | (
                    Q(price_type="RANGE")
                    & Q(minimum_price__isnull=False)
                    & Q(maximum_price__isnull=False)
                    & Q(maximum_price__gte=F("minimum_price"))
                )
                | (
                    Q(price_type="ON_REQUEST")
                    & Q(minimum_price__isnull=True)
                    & Q(maximum_price__isnull=True)
                ),
                name="service_price_matches_price_type",
            ),
            models.CheckConstraint(
                condition=(
                    Q(duration_minutes__isnull=True)
                    | Q(duration_minutes__gte=1, duration_minutes__lte=1440)
                ),
                name="service_duration_valid",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.is_active and self.provider_id:
            if (
                self.provider.verification_status
                != Provider.VerificationStatus.VERIFIED
            ):
                raise ValidationError(
                    {"is_active": "Apenas prestadores verificados podem publicar serviços."}
                )
            if not self.provider.user.is_active:
                raise ValidationError(
                    {"is_active": "A conta do prestador está inativa."}
                )
        if self.category_id and not self.category.is_active and self.is_active:
            raise ValidationError(
                {"category": "Não é possível publicar serviços numa categoria inativa."}
            )


class CatalogAuditEvent(models.Model):
    class Action(models.TextChoices):
        CATEGORY_CREATED = "CATEGORY_CREATED", "Categoria criada"
        CATEGORY_UPDATED = "CATEGORY_UPDATED", "Categoria atualizada"
        CATEGORY_DEACTIVATED = "CATEGORY_DEACTIVATED", "Categoria desativada"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="catalog_audit_events",
        null=True,
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    category_id_snapshot = models.PositiveBigIntegerField()
    category_name_snapshot = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "evento de auditoria do catálogo"
        verbose_name_plural = "eventos de auditoria do catálogo"


__all__ = ("CatalogAuditEvent", "Category", "Service")
