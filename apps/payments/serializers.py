from rest_framework import serializers

from .models import Payment
from .services import criar_registo_pagamento


class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField()

    class Meta:
        model = Payment
        fields = (
            "id",
            "booking_id",
            "amount",
            "currency",
            "method",
            "external_reference",
            "status",
            "created_at",
            "reviewed_at",
        )
        read_only_fields = (
            "id",
            "amount",
            "currency",
            "status",
            "created_at",
            "reviewed_at",
        )

    def validate(self, atributos):
        proibido = {
            "booking",
            "amount",
            "currency",
            "status",
            "client",
            "client_id",
            "reviewed_by",
            "reviewed_by_id",
            "reviewed_at",
        }
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo é definido pelo sistema ou por um administrador." for campo in fornecido}
            )
        return atributos

    def create(self, dados_validados):
        return criar_registo_pagamento(
            booking_id=dados_validados["booking_id"],
            actor=self.context["request"].user,
            method=dados_validados["method"],
            external_reference=dados_validados.get("external_reference", ""),
        )
