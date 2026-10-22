from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.catalog.models import Category
from apps.providers.models import Provider

from .models import Product, ProductOrder, ProductOrderItem


class ProductSerializer(serializers.ModelSerializer):
    provider_id = serializers.IntegerField(read_only=True)
    provider_name = serializers.CharField(source="provider.commercial_name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
    )

    class Meta:
        model = Product
        fields = (
            "id",
            "provider_id",
            "provider_name",
            "category",
            "category_name",
            "name",
            "description",
            "price",
            "currency",
            "stock_quantity",
            "image",
            "image_url",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "provider_id",
            "provider_name",
            "category_name",
            "currency",
            "created_at",
            "updated_at",
        )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Indica o nome do produto.")
        return value

    def validate_currency(self, value):
        if value.strip().upper() != "AOA":
            raise serializers.ValidationError("A moeda disponível nesta fase é AOA.")
        return "AOA"

    def validate(self, attributes):
        if {"provider", "provider_id", "owner", "owner_id"}.intersection(
            self.initial_data
        ):
            raise serializers.ValidationError(
                "A empresa é definida pela conta autenticada."
            )
        provider = getattr(self.context["request"].user, "provider", None)
        if provider is None:
            raise PermissionDenied("Cria primeiro o perfil da empresa para gerir produtos.")
        active = attributes.get(
            "is_active",
            self.instance.is_active if self.instance is not None else False,
        )
        category = attributes.get(
            "category",
            self.instance.category if self.instance is not None else None,
        )
        if active and (
            not provider.user.is_active
            or provider.verification_status != Provider.VerificationStatus.VERIFIED
        ):
            raise serializers.ValidationError(
                {"is_active": "Apenas empresas verificadas e ativas podem publicar produtos."}
            )
        if active and not (provider.business_email or provider.business_phone):
            raise serializers.ValidationError(
                {"is_active": "Indica um email ou telefone comercial no perfil da empresa antes de publicar produtos."}
            )
        if active and category is not None and not category.is_active:
            raise serializers.ValidationError(
                {"category": "Não é possível publicar numa categoria inativa."}
            )
        return attributes


class ProductOrderItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = ProductOrderItem
        fields = ("product_id", "product_name", "unit_price", "quantity", "subtotal")
        read_only_fields = fields


class ProductOrderSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.commercial_name", read_only=True)
    is_buyer = serializers.SerializerMethodField()
    is_provider = serializers.SerializerMethodField()
    buyer_email = serializers.SerializerMethodField()
    buyer_phone = serializers.SerializerMethodField()
    provider_email = serializers.SerializerMethodField()
    provider_phone = serializers.CharField(source="provider.business_phone", read_only=True)
    items = ProductOrderItemSerializer(many=True, read_only=True)
    payment_note = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    class Meta:
        model = ProductOrder
        fields = (
            "id",
            "provider_name",
            "is_buyer",
            "is_provider",
            "buyer_email",
            "buyer_phone",
            "provider_email",
            "provider_phone",
            "status",
            "total_amount",
            "currency",
            "delivery_notes",
            "payment_note",
            "items",
            "review",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_is_buyer(self, order):
        request = self.context.get("request")
        return request is not None and order.buyer_id == request.user.pk

    def get_is_provider(self, order):
        request = self.context.get("request")
        return request is not None and order.provider.user_id == request.user.pk

    def get_buyer_email(self, order):
        request = self.context.get("request")
        return order.buyer.email if request is not None and order.provider.user_id == request.user.pk else ""

    def get_buyer_phone(self, order):
        request = self.context.get("request")
        return order.buyer.phone or "" if request is not None and order.provider.user_id == request.user.pk else ""

    def get_provider_email(self, order):
        request = self.context.get("request")
        if request is None or order.buyer_id != request.user.pk:
            return ""
        return order.provider.business_email or ""

    def get_payment_note(self, order):
        return "Combina o pagamento e a entrega diretamente com a empresa."

    def get_review(self, order):
        try:
            review = order.review
        except ObjectDoesNotExist:
            return None
        return {
            "rating": review.rating,
            "comment": review.comment,
            "created_at": review.created_at,
        }


class ProductOrderLineInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=99)


class ProductOrderCreateSerializer(serializers.Serializer):
    items = ProductOrderLineInputSerializer(many=True, allow_empty=False)
    delivery_notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)

    def validate_items(self, value):
        product_ids = [item["product_id"] for item in value]
        if len(set(product_ids)) != len(product_ids):
            raise serializers.ValidationError(
                "Cada produto só pode aparecer uma vez na encomenda."
            )
        return value
