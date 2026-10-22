from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    proposal_id = serializers.IntegerField(read_only=True)
    order_id = serializers.IntegerField(read_only=True)
    is_client = serializers.SerializerMethodField()
    is_provider = serializers.SerializerMethodField()
    provider_name = serializers.CharField(
        source="provider.commercial_name",
        read_only=True,
    )
    service_name = serializers.CharField(source="service.name", read_only=True)
    review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "order_id",
            "proposal_id",
            "is_client",
            "is_provider",
            "provider_name",
            "service_name",
            "final_price",
            "duration_minutes",
            "currency",
            "scheduled_at",
            "status",
            "created_at",
            "updated_at",
            "completed_at",
            "review",
        )
        read_only_fields = fields

    def get_is_client(self, booking):
        requisicao = self.context.get("request")
        return requisicao is not None and booking.client_id == requisicao.user.pk

    def get_is_provider(self, booking):
        requisicao = self.context.get("request")
        return (
            requisicao is not None
            and booking.provider.user_id == requisicao.user.pk
        )

    def get_review(self, booking):
        try:
            review = booking.review
        except ObjectDoesNotExist:
            return None
        return {
            "rating": review.rating,
            "comment": review.comment,
            "created_at": review.created_at,
        }
