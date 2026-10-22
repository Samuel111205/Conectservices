from rest_framework import serializers

from .models import Review
from .services import criar_avaliacao


class ReviewSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(write_only=True, required=False)
    product_order_id = serializers.IntegerField(write_only=True, required=False)
    provider_id = serializers.SerializerMethodField()
    provider_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "booking_id",
            "product_order_id",
            "provider_id",
            "provider_name",
            "rating",
            "comment",
            "created_at",
        )
        read_only_fields = ("id", "provider_id", "provider_name", "created_at")

    def validate(self, atributos):
        proibido = {
            "booking",
            "product_order",
            "provider",
            "provider_id",
            "client",
            "client_id",
        }
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo não pode ser definido pelo utilizador." for campo in fornecido}
            )
        tem_contratacao = "booking_id" in atributos
        tem_encomenda = "product_order_id" in atributos
        if tem_contratacao == tem_encomenda:
            raise serializers.ValidationError(
                "Indica uma contratação ou uma encomenda concluída para avaliar."
            )
        return atributos

    def get_provider_id(self, review):
        if review.booking_id is not None:
            return review.booking.provider_id
        return review.product_order.provider_id

    def get_provider_name(self, review):
        if review.booking_id is not None:
            return review.booking.provider.commercial_name
        return review.product_order.provider.commercial_name

    def create(self, dados_validados):
        return criar_avaliacao(
            booking_id=dados_validados.get("booking_id"),
            product_order_id=dados_validados.get("product_order_id"),
            actor=self.context["request"].user,
            rating=dados_validados["rating"],
            comment=dados_validados.get("comment", ""),
        )
