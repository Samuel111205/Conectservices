from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.catalog.models import Service
from apps.providers.models import Provider

from .models import FavoriteProvider, FavoriteService


class FavoriteProviderSerializer(serializers.ModelSerializer):
    provider = serializers.PrimaryKeyRelatedField(
        queryset=Provider.objects.all(),
    )
    commercial_name = serializers.CharField(
        source="provider.commercial_name",
        read_only=True,
    )

    class Meta:
        model = FavoriteProvider
        fields = ("id", "provider", "commercial_name", "created_at")
        read_only_fields = ("id", "commercial_name", "created_at")

    def validate(self, atributos):
        proibido = {"user", "user_id", "owner", "owner_id", "provider_id"}
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )

        prestador = atributos["provider"]
        public_service = Service.objects.filter(
            provider=prestador,
            is_active=True,
            category__is_active=True,
        ).exists()
        if (
            prestador.verification_status != Provider.VerificationStatus.VERIFIED
            or not prestador.user.is_active
            or not public_service
        ):
            raise ValidationError(
                {"provider": "O prestador não está disponível para descoberta."}
            )
        if prestador.user_id == self.context["request"].user.pk:
            raise ValidationError({"provider": "Não é possível favoritar o próprio perfil."})
        return atributos

    def create(self, dados_validados):
        favorite, criado = FavoriteProvider.objects.get_or_create(
            user=self.context["request"].user,
            provider=dados_validados["provider"],
        )
        self.was_created = criado
        return favorite


class FavoriteServiceSerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
    )
    service_name = serializers.CharField(source="service.name", read_only=True)
    provider_name = serializers.CharField(
        source="service.provider.commercial_name",
        read_only=True,
    )
    currency = serializers.CharField(source="service.currency", read_only=True)
    minimum_price = serializers.DecimalField(
        source="service.minimum_price",
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        read_only=True,
    )
    maximum_price = serializers.DecimalField(
        source="service.maximum_price",
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        read_only=True,
    )

    class Meta:
        model = FavoriteService
        fields = (
            "id",
            "service",
            "service_name",
            "provider_name",
            "minimum_price",
            "maximum_price",
            "currency",
            "created_at",
        )
        read_only_fields = (
            "id",
            "service_name",
            "provider_name",
            "minimum_price",
            "maximum_price",
            "currency",
            "created_at",
        )

    def validate(self, atributos):
        proibido = {"user", "user_id", "owner", "owner_id", "service_id"}
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )

        servico = atributos["service"]
        prestador = servico.provider
        if (
            not servico.is_active
            or not servico.category.is_active
            or prestador.verification_status != Provider.VerificationStatus.VERIFIED
            or not prestador.user.is_active
        ):
            raise ValidationError(
                {"service": "O serviço não está disponível para descoberta."}
            )
        if prestador.user_id == self.context["request"].user.pk:
            raise ValidationError({"service": "Não é possível favoritar o próprio serviço."})
        return atributos

    def create(self, dados_validados):
        favorite, criado = FavoriteService.objects.get_or_create(
            user=self.context["request"].user,
            service=dados_validados["service"],
        )
        self.was_created = criado
        return favorite
