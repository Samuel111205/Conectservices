from rest_framework import serializers

from .models import WeeklyAvailability
from .services import guardar_disponibilidade_semanal


class WeeklyAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyAvailability
        fields = (
            "id",
            "weekday",
            "start_time",
            "end_time",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, atributos):
        fornecido = {"provider", "provider_id", "user", "user_id"}.intersection(
            self.initial_data
        )
        if fornecido:
            raise serializers.ValidationError(
                {campo: "O prestador é determinado pela conta autenticada." for campo in fornecido}
            )
        weekday = atributos.get(
            "weekday",
            self.instance.weekday if self.instance is not None else None,
        )
        start_time = atributos.get(
            "start_time",
            self.instance.start_time if self.instance is not None else None,
        )
        end_time = atributos.get(
            "end_time",
            self.instance.end_time if self.instance is not None else None,
        )
        if start_time is not None and end_time is not None and end_time <= start_time:
            raise serializers.ValidationError(
                {"end_time": "A hora de fim deve ser posterior à hora de início."}
            )
        return atributos

    def create(self, dados_validados):
        prestador = getattr(self.context["request"].user, "provider", None)
        if prestador is None:
            raise serializers.ValidationError(
                "Cria primeiro o perfil de prestador para gerir a disponibilidade."
            )
        return guardar_disponibilidade_semanal(provider=prestador, **dados_validados)

    def update(self, instance, dados_validados):
        return guardar_disponibilidade_semanal(
            provider=instance.provider,
            instance=instance,
            **dados_validados,
        )
