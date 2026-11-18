from rest_framework import serializers

from .models import Dispute, DisputeMessage
from .services import abrir_disputa, enviar_mensagem_disputa


class DisputeMessageSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = DisputeMessage
        fields = ("id", "author_id", "body", "created_at")
        read_only_fields = fields


class DisputeCreateSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField(min_value=1)
    category = serializers.ChoiceField(choices=Dispute.Category.choices)
    description = serializers.CharField(max_length=5000, trim_whitespace=True)

    def validate(self, attributes):
        fornecido = set(self.initial_data).difference(
            {"booking_id", "category", "description"}
        )
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        return attributes

    def create(self, validated_data):
        return abrir_disputa(
            booking_id=validated_data["booking_id"],
            actor=self.context["request"].user,
            category=validated_data["category"],
            description=validated_data["description"],
        )


class DisputeSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(read_only=True)
    opened_by_id = serializers.IntegerField(read_only=True, allow_null=True)
    reviewed_by_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Dispute
        fields = (
            "id",
            "booking_id",
            "opened_by_id",
            "category",
            "description",
            "status",
            "resolution",
            "reviewed_by_id",
            "created_at",
            "updated_at",
            "resolved_at",
        )
        read_only_fields = fields


class DisputeMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=4000, trim_whitespace=True)

    def validate(self, attributes):
        fornecido = set(self.initial_data).difference({"body"})
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        return attributes

    def create(self, validated_data):
        return enviar_mensagem_disputa(
            dispute_id=self.context["dispute_id"],
            actor=self.context["request"].user,
            body=validated_data["body"],
        )


class DisputeReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(Dispute.Status.UNDER_REVIEW, Dispute.Status.RESOLVED, Dispute.Status.CLOSED)
    )
    resolution = serializers.CharField(max_length=5000, required=False, allow_blank=True)

    def validate(self, attributes):
        fornecido = set(self.initial_data).difference({"status", "resolution"})
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        return attributes


