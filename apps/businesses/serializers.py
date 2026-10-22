import json

from rest_framework import serializers

from .models import BusinessProfile
from .services import atualizar_perfil_empresarial, criar_perfil_empresarial


class BusinessProfilePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessProfile
        fields = ("logo", "website", "opening_hours")
        read_only_fields = fields


class BusinessProfileSerializer(serializers.ModelSerializer):
    commercial_name = serializers.CharField(source="provider.commercial_name")
    description = serializers.CharField(
        source="provider.description",
        required=False,
        allow_blank=True,
    )
    business_phone = serializers.CharField(
        source="provider.business_phone",
        required=False,
        allow_blank=True,
    )
    business_email = serializers.EmailField(
        source="provider.business_email",
        required=False,
        allow_blank=True,
    )
    verification_status = serializers.CharField(
        source="provider.verification_status",
        read_only=True,
    )
    verified_at = serializers.DateTimeField(
        source="provider.verified_at",
        read_only=True,
    )

    class Meta:
        model = BusinessProfile
        fields = (
            "id",
            "commercial_name",
            "description",
            "business_phone",
            "business_email",
            "verification_status",
            "verified_at",
            "registered_name",
            "logo",
            "website",
            "address",
            "opening_hours",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "verification_status",
            "verified_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attributes):
        forbidden = {
            "provider",
            "provider_id",
            "user",
            "user_id",
            "owner",
            "owner_id",
            "verification_status",
            "verified_at",
            "verification_submitted_at",
            "verification_feedback",
        }
        supplied = forbidden.intersection(self.initial_data)
        if supplied:
            raise serializers.ValidationError(
                {
                    field: "Este campo só pode ser alterado por um administrador."
                    for field in supplied
                }
            )
        return attributes

    def validate_opening_hours(self, value):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(
                    "Envia os horários como um objecto JSON válido."
                ) from exc

        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Indica os horários num objecto com os dias da semana."
            )

        days = {
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        }
        unknown_days = set(value) - days
        if unknown_days:
            raise serializers.ValidationError(
                "Usa os dias em inglês: monday, tuesday, wednesday, thursday, friday, saturday ou sunday."
            )
        if any(
            not isinstance(hours, str) or len(hours) > 120
            for hours in value.values()
        ):
            raise serializers.ValidationError(
                "Cada horário deve ser texto com até 120 caracteres."
            )
        return value

    def create(self, validated_data):
        provider_data = validated_data.pop("provider", {})
        return criar_perfil_empresarial(
            user=self.context["request"].user,
            provider_data=provider_data,
            business_data=validated_data,
        )

    def update(self, instance, validated_data):
        provider_data = validated_data.pop("provider", {})
        return atualizar_perfil_empresarial(
            profile=instance,
            provider_data=provider_data,
            business_data=validated_data,
        )
