from decimal import Decimal

from rest_framework import serializers

from .models import RefundRequest
from .services import criar_pedido_reembolso


class RefundRequestCreateSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField(min_value=1)
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    reason = serializers.CharField(max_length=3000, trim_whitespace=True)

    def validate(self, attributes):
        fornecido = set(self.initial_data).difference({"booking_id", "amount", "reason"})
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        return attributes

    def create(self, validated_data):
        return criar_pedido_reembolso(
            booking_id=validated_data["booking_id"],
            actor=self.context["request"].user,
            amount=validated_data["amount"],
            reason=validated_data["reason"],
        )


class RefundRequestSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(source="payment.booking_id", read_only=True)
    payment_id = serializers.IntegerField(read_only=True)
    currency = serializers.CharField(source="payment.currency", read_only=True)
    requested_by_id = serializers.IntegerField(read_only=True, allow_null=True)
    reviewed_by_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = RefundRequest
        fields = (
            "id",
            "booking_id",
            "payment_id",
            "requested_by_id",
            "amount",
            "currency",
            "reason",
            "status",
            "decision_note",
            "reviewed_by_id",
            "payout_reference",
            "created_at",
            "updated_at",
            "reviewed_at",
            "refunded_at",
        )
        read_only_fields = fields


class RefundReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(RefundRequest.Status.APPROVED, RefundRequest.Status.REJECTED)
    )
    decision_note = serializers.CharField(max_length=3000, required=False, allow_blank=True)

    def validate(self, attributes):
        fornecido = set(self.initial_data).difference({"status", "decision_note"})
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        return attributes


class RefundPaidSerializer(serializers.Serializer):
    payout_reference = serializers.CharField(max_length=120, trim_whitespace=True)

    def validate(self, attributes):
        fornecido = set(self.initial_data).difference({"payout_reference"})
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        return attributes


