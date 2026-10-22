from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from apps.catalog.models import Category
from apps.profiles.validators import validate_profile_photo
from apps.providers.models import Provider


def product_image_upload_to(instance, filename):
    return f"commerce/products/{instance.provider_id}/{filename}"


class Product(models.Model):
    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="products",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.01")),),
    )
    currency = models.CharField(max_length=3, default="AOA")
    stock_quantity = models.PositiveIntegerField(default=0)
    image = models.ImageField(
        upload_to=product_image_upload_to,
        blank=True,
        validators=(validate_profile_photo,),
    )
    image_url = models.URLField(blank=True, max_length=1000)
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name", "pk")
        verbose_name = "produto"
        verbose_name_plural = "produtos"
        constraints = [
            models.CheckConstraint(
                condition=Q(price__gt=0),
                name="product_price_positive",
            ),
        ]
        indexes = [
            models.Index(fields=("provider", "is_active", "name"), name="product_provider_active_idx"),
            models.Index(fields=("category", "is_active", "name"), name="product_category_active_idx"),
        ]

    def __str__(self):
        return self.name


class ProductOrder(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "A aguardar confirmação"
        ACCEPTED = "ACCEPTED", "Aceite pela empresa"
        COMPLETED = "COMPLETED", "Concluída"
        CANCELLED = "CANCELLED", "Cancelada"
        REJECTED = "REJECTED", "Recusada pela empresa"

    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="product_orders",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.PROTECT,
        related_name="product_orders",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.01")),),
    )
    currency = models.CharField(max_length=3, default="AOA")
    delivery_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-pk")
        verbose_name = "encomenda de produto"
        verbose_name_plural = "encomendas de produtos"
        constraints = [
            models.CheckConstraint(
                condition=Q(total_amount__gt=0),
                name="product_order_total_positive",
            ),
        ]
        indexes = [
            models.Index(fields=("buyer", "status", "-created_at"), name="product_order_buyer_idx"),
            models.Index(fields=("provider", "status", "-created_at"), name="product_order_provider_idx"),
        ]

    def __str__(self):
        return f"Encomenda #{self.pk} — {self.provider.commercial_name}"


class ProductOrderItem(models.Model):
    order = models.ForeignKey(
        ProductOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    product_name = models.CharField(max_length=160)
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=(MinValueValidator(Decimal("0.01")),),
    )
    quantity = models.PositiveIntegerField(validators=(MinValueValidator(1),))

    class Meta:
        ordering = ("pk",)
        verbose_name = "artigo de encomenda"
        verbose_name_plural = "artigos de encomenda"
        constraints = [
            models.CheckConstraint(
                condition=Q(unit_price__gt=0),
                name="product_order_item_price_positive",
            ),
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="product_order_item_quantity_positive",
            ),
        ]

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.quantity} × {self.product_name}"
