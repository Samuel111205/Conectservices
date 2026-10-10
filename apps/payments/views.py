from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = PaymentSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Payment.objects.none()
        utilizador = self.request.user
        return Payment.objects.filter(
            Q(booking__client=utilizador) | Q(booking__provider__user=utilizador)
        ).select_related("booking")
