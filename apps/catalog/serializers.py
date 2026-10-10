from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .models import Category, Service


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "description",
            "parent",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, value):
        return value.strip()

    def validate(self, atributos):
        parent = atributos.get(
            "parent",
            self.instance.parent if self.instance is not None else None,
        )
        is_active = atributos.get(
            "is_active",
            self.instance.is_active if self.instance is not None else True,
        )

        if parent is not None and not parent.is_active and is_active:
            raise serializers.ValidationError(
                {"parent": "Não é possível ativar uma categoria sob um pai inativo."}
            )

        if self.instance is not None:
            if parent == self.instance:
                raise serializers.ValidationError(
                    {"parent": "Uma categoria não pode ser pai de si própria."}
                )

            ancestor = parent
            while ancestor is not None:
                if ancestor == self.instance:
                    raise serializers.ValidationError(
                        {"parent": "A hierarquia criaria uma referência circular."}
                    )
                ancestor = ancestor.parent

            if not is_active and self.instance.children.filter(is_active=True).exists():
                raise serializers.ValidationError(
                    {"is_active": "Desative primeiro as subcategorias ativas."}
                )

        return atributos


class ServiceSerializer(serializers.ModelSerializer):
    provider_id = serializers.IntegerField(read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True)
    )

    class Meta:
        model = Service
        fields = (
            "id",
            "provider_id",
            "category",
            "name",
            "description",
            "minimum_price",
            "maximum_price",
            "currency",
            "price_type",
            "duration_minutes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "provider_id", "created_at", "updated_at")

    def validate_name(self, value):
        return value.strip()

    def validate_currency(self, value):
        normalized = value.strip().upper()
        if normalized != "AOA":
            raise serializers.ValidationError(
                "A moeda disponível nesta fase é AOA."
            )
        return normalized

    def validate_duration_minutes(self, value):
        if value is not None and not 1 <= value <= 1440:
            raise serializers.ValidationError(
                "A duração tem de estar entre 1 e 1.440 minutos."
            )
        return value

    def validate(self, atributos):
        proibido = {"provider", "provider_id", "owner", "owner_id"}
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {
                    campo: "O prestador é definido pela conta autenticada."
                    for campo in fornecido
                }
            )

        prestador = getattr(self.context["request"].user, "provider", None)
        if prestador is None:
            raise PermissionDenied(
                "Cria primeiro o perfil de prestador para gerir serviços."
            )

        price_type = atributos.get(
            "price_type",
            self.instance.price_type if self.instance is not None else None,
        )
        minimum_price = atributos.get(
            "minimum_price",
            self.instance.minimum_price if self.instance is not None else None,
        )
        maximum_price = atributos.get(
            "maximum_price",
            self.instance.maximum_price if self.instance is not None else None,
        )
        if price_type is None:
            raise serializers.ValidationError(
                {"price_type": "Indica o tipo de preço do serviço."}
            )

        if price_type == Service.PriceType.FIXED:
            if minimum_price is None or maximum_price != minimum_price:
                raise serializers.ValidationError(
                    {
                        "maximum_price": (
                            "Para preço fixo, o valor mínimo e máximo devem ser iguais."
                        )
                    }
                )
        elif price_type == Service.PriceType.STARTING_AT:
            if minimum_price is None or maximum_price is not None:
                raise serializers.ValidationError(
                    {
                        "minimum_price": (
                            "Indica o preço inicial e deixa o máximo vazio."
                        )
                    }
                )
        elif price_type == Service.PriceType.RANGE:
            if minimum_price is None or maximum_price is None:
                raise serializers.ValidationError(
                    {"minimum_price": "Indica os valores mínimo e máximo."}
                )
            if maximum_price < minimum_price:
                raise serializers.ValidationError(
                    {"maximum_price": "O máximo não pode ser inferior ao mínimo."}
                )
        elif price_type == Service.PriceType.ON_REQUEST:
            if minimum_price is not None or maximum_price is not None:
                raise serializers.ValidationError(
                    {
                        "minimum_price": (
                            "Remove os valores para serviços sob consulta."
                        )
                    }
                )

        is_active = atributos.get(
            "is_active",
            self.instance.is_active if self.instance is not None else False,
        )
        categoria = atributos.get(
            "category",
            self.instance.category if self.instance is not None else None,
        )
        if is_active:
            if prestador.verification_status != prestador.VerificationStatus.VERIFIED:
                raise serializers.ValidationError(
                    {
                        "is_active": (
                            "Apenas prestadores verificados podem publicar serviços."
                        )
                    }
                )
            if not prestador.user.is_active:
                raise serializers.ValidationError(
                    {"is_active": "A conta do prestador está inativa."}
                )
            if categoria is not None and not categoria.is_active:
                raise serializers.ValidationError(
                    {"category": "Não é possível publicar numa categoria inativa."}
                )
        return atributos
