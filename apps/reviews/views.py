from decimal import Decimal

from django.db.models import Avg, Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Review
from .serializers import ReviewSerializer


class ReviewViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ReviewSerializer
    permission_classes = (IsAuthenticatedOrReadOnly,)
    http_method_names = ("get", "post", "head", "options")

    def _provider_id(self, *, required=False):
        id_prestador = self.request.query_params.get("provider_id")
        if id_prestador is None and not required:
            return None
        if id_prestador is None or not id_prestador.isdecimal():
            raise ValidationError(
                {"provider_id": "Informe um identificador numérico."}
            )
        return int(id_prestador)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Review.objects.none()
        consulta = Review.objects.select_related(
            "booking__provider",
            "product_order__provider",
        )
        id_prestador = self._provider_id()
        if id_prestador is not None:
            consulta = consulta.filter(
                Q(booking__provider_id=id_prestador)
                | Q(product_order__provider_id=id_prestador)
            )
        return consulta

    @action(detail=False, methods=("get",))
    def summary(self, request):
        id_prestador = self._provider_id(required=True)
        summary = Review.objects.filter(
            Q(booking__provider_id=id_prestador)
            | Q(product_order__provider_id=id_prestador),
        ).aggregate(
            average=Avg("rating"),
            count=Count("pk"),
        )
        average = summary["average"]
        return Response(
            {
                "provider_id": id_prestador,
                "average_rating": (
                    str(Decimal(str(average)).quantize(Decimal("0.01")))
                    if average is not None
                    else None
                ),
                "review_count": summary["count"],
            }
        )
