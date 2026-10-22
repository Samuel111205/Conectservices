from rest_framework import serializers

from apps.businesses.serializers import BusinessProfilePublicSerializer

from .models import Provider, ProviderVerificationDocument
from .validators import validate_verification_document


class ProviderDiscoverySerializer(serializers.ModelSerializer):
    business_profile = BusinessProfilePublicSerializer(read_only=True)
    active_service_count = serializers.IntegerField(read_only=True)
    average_rating = serializers.DecimalField(
        max_digits=3,
        decimal_places=2,
        allow_null=True,
        read_only=True,
    )
    review_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Provider
        fields = (
            "id",
            "commercial_name",
            "description",
            "business_profile",
            "active_service_count",
            "average_rating",
            "review_count",
        )


class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = (
            "id",
            "commercial_name",
            "description",
            "business_phone",
            "business_email",
            "verification_status",
            "verified_at",
            "verification_submitted_at",
            "verification_feedback",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "verification_status",
            "verified_at",
            "verification_submitted_at",
            "verification_feedback",
            "created_at",
            "updated_at",
        )

    def validate(self, atributos):
        proibido = {
            "user",
            "user_id",
            "owner",
            "owner_id",
            "verification_status",
            "verified_at",
            "verification_submitted_at",
            "verification_feedback",
        }
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo só pode ser alterado por um administrador." for campo in fornecido}
            )
        return atributos

    def create(self, dados_validados):
        from .services import criar_prestador

        return criar_prestador(user=self.context["request"].user, **dados_validados)


class ProviderVerificationDocumentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(
        write_only=True,
        validators=(validate_verification_document,),
    )

    class Meta:
        model = ProviderVerificationDocument
        fields = ("id", "document_type", "file", "uploaded_at")
        read_only_fields = ("id", "uploaded_at")

    def create(self, dados_validados):
        return ProviderVerificationDocument.objects.create(
            provider=self.context["provider"],
            **dados_validados,
        )
