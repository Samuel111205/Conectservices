from datetime import date

from rest_framework import serializers

from .models import Profile
from .validators import validate_profile_photo


class ProfileSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(
        required=False,
        allow_null=False,
        validators=(validate_profile_photo,),
    )

    class Meta:
        model = Profile
        fields = (
            "id",
            "full_name",
            "photo",
            "biography",
            "birth_date",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_birth_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError(
                "A data de nascimento não pode estar no futuro."
            )
        return value

    def validate(self, atributos):
        proibido = {"user", "user_id", "owner", "owner_id"}
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {
                    campo: "Este campo é definido pela conta autenticada."
                    for campo in fornecido
                }
            )
        return atributos

    def create(self, dados_validados):
        from .services import criar_perfil

        return criar_perfil(user=self.context["request"].user, **dados_validados)
