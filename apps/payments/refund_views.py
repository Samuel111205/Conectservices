from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import RefundRequest
from .refund_serializers import (
    RefundPaidSerializer,
    RefundRequestCreateSerializer,
    RefundRequestSerializer,
    RefundReviewSerializer,
)
from .services import (
    avaliar_pedido_reembolso,
    cancelar_pedido_reembolso,
    confirmar_reembolso_pago,
)


class RefundRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RefundRequestSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return RefundRequest.objects.none()
        utilizador = self.request.user
        queryset = RefundRequest.objects.select_related(
            "payment__booking__client",
            "payment__booking__provider__user",
            "requested_by",
            "reviewed_by",
        )
        if utilizador.is_staff:
            return queryset
        return queryset.filter(
            Q(payment__booking__client=utilizador)
            | Q(payment__booking__provider__user=utilizador)
        )

    def get_serializer_class(self):
        if self.action == "create":
            return RefundRequestCreateSerializer
        return self.serializer_class

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        output = RefundRequestSerializer(pedido, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=RefundRequestSerializer)
    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        self.get_object()
        if request.data:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("Esta acção não aceita campos adicionais.")
        pedido = cancelar_pedido_reembolso(refund_request_id=pk, actor=request.user)
        return Response(RefundRequestSerializer(pedido).data)

    @extend_schema(request=RefundReviewSerializer, responses=RefundRequestSerializer)
    @action(detail=True, methods=("post",), url_path="review")
    def review(self, request, pk=None):
        if not request.user.is_staff:
            raise PermissionDenied("Só a equipa de apoio pode rever pedidos de reembolso.")
        serializer = RefundReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = avaliar_pedido_reembolso(
            refund_request_id=pk,
            actor=request.user,
            status=serializer.validated_data["status"],
            note=serializer.validated_data.get("decision_note", ""),
        )
        return Response(RefundRequestSerializer(pedido).data)

    @extend_schema(request=RefundPaidSerializer, responses=RefundRequestSerializer)
    @action(detail=True, methods=("post",), url_path="confirm-paid")
    def confirm_paid(self, request, pk=None):
        self.get_object()
        serializer = RefundPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = confirmar_reembolso_pago(
            refund_request_id=pk,
            actor=request.user,
            payout_reference=serializer.validated_data["payout_reference"],
        )
        return Response(RefundRequestSerializer(pedido).data)
