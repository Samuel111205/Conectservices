from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.catalog.models import Category
from apps.locations.models import Municipality

from .models import ServiceOrder


class ServiceOrderSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True)
    )
    municipality = serializers.PrimaryKeyRelatedField(
        queryset=Municipality.objects.filter(
            is_active=True,
            province__is_active=True,
        )
    )
    municipality_name = serializers.CharField(
        source="municipality_name_snapshot",
        read_only=True,
    )
    province_name = serializers.CharField(
        source="province_name_snapshot",
        read_only=True,
    )
    neighborhood = serializers.CharField(
        source="neighborhood_snapshot",
        required=False,
        allow_blank=True,
    )
    address = serializers.CharField(
        source="address_snapshot",
        required=False,
        allow_blank=True,
    )
    latitude = serializers.DecimalField(
        source="latitude_snapshot",
        max_digits=10,
        decimal_places=7,
        required=False,
        allow_null=True,
        min_value=Decimal("-90"),
        max_value=Decimal("90"),
    )
    longitude = serializers.DecimalField(
        source="longitude_snapshot",
        max_digits=10,
        decimal_places=7,
        required=False,
        allow_null=True,
        min_value=Decimal("-180"),
        max_value=Decimal("180"),
    )

    class Meta:
        model = ServiceOrder
        fields = (
            "id",
            "category",
            "title",
            "description",
            "minimum_budget",
            "maximum_budget",
            "requested_duration_minutes",
            "currency",
            "municipality",
            "municipality_name",
            "province_name",
            "neighborhood",
            "address",
            "latitude",
            "longitude",
            "requested_at",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "municipality_name",
            "province_name",
            "status",
            "created_at",
            "updated_at",
        )

    def validate(self, atributos):
        proibido = {
            "client",
            "client_id",
            "user",
            "user_id",
            "status",
            "currency",
        }
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {
                    campo: "Este campo é gerido pelo sistema."
                    for campo in fornecido
                }
            )

        if self.instance is not None:
            raise serializers.ValidationError(
                "Os pedidos não podem ser editados depois da criação; cancela e cria um novo."
            )

        if "title" in atributos:
            atributos["title"] = atributos["title"].strip()
        if "category" not in atributos or "municipality" not in atributos:
            raise serializers.ValidationError(
                "Indica a categoria e o município do serviço."
            )
        minimum = atributos.get("minimum_budget")
        maximum = atributos.get("maximum_budget")
        if minimum is not None and maximum is not None and maximum < minimum:
            raise serializers.ValidationError(
                {"maximum_budget": "O orçamento máximo não pode ser inferior ao mínimo."}
            )
        if atributos.get("requested_at") and atributos["requested_at"] <= timezone.now():
            raise serializers.ValidationError(
                {"requested_at": "A data pretendida tem de estar no futuro."}
            )

        latitude = atributos.get("latitude_snapshot")
        longitude = atributos.get("longitude_snapshot")
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                {"coordinates": "Latitude e longitude devem ser fornecidas em conjunto."}
            )

        municipio = atributos["municipality"]
        atributos["municipality_name_snapshot"] = municipio.name
        atributos["province_name_snapshot"] = municipio.province.name
        atributos["currency"] = "AOA"
        return atributos

    def create(self, dados_validados):
        return ServiceOrder.objects.create(
            client=self.context["request"].user,
            **dados_validados,
        )


class OrderOpportunitySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = ServiceOrder
        fields = (
            "id",
            "category",
            "category_name",
            "title",
            "description",
            "minimum_budget",
            "maximum_budget",
            "requested_duration_minutes",
            "currency",
            "municipality_name_snapshot",
            "province_name_snapshot",
            "neighborhood_snapshot",
            "requested_at",
            "created_at",
            "status",
        )


class OrderStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOrder
        fields = ("id", "status", "updated_at")
        read_only_fields = fields
