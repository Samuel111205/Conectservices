from rest_framework import serializers

from .models import Review
from .services import criar_avaliacao


class ReviewSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(write_only=True)
    provider_id = serializers.IntegerField(
        source="booking.provider_id",
        read_only=True,
    )
    provider_name = serializers.CharField(
        source="booking.provider.commercial_name",
        read_only=True,
    )

    class Meta:
        model = Review
        fields = (
            "id",
            "booking_id",
            "provider_id",
            "provider_name",
            "rating",
            "comment",
            "created_at",
        )
        read_only_fields = ("id", "provider_id", "provider_name", "created_at")

    def validate(self, atributos):
        proibido = {"booking", "provider", "provider_id", "client", "client_id"}
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        return atributos

    def create(self, dados_validados):
        return criar_avaliacao(
            booking_id=dados_validados["booking_id"],
            actor=self.context["request"].user,
            rating=dados_validados["rating"],
            comment=dados_validados.get("comment", ""),
        )
