from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.providers.models import Provider

from .models import ServiceOrder
from .serializers import (
    OrderOpportunitySerializer,
    OrderStatusSerializer,
    ServiceOrderSerializer,
)
from .services import cancelar_pedido


class ServiceOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ServiceOrderSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ServiceOrder.objects.none()
        if self.action == "opportunities":
            prestador = getattr(self.request.user, "provider", None)
            if prestador is None:
                return ServiceOrder.objects.none()
            if (
                not self.request.user.is_active
                or prestador.verification_status
                != Provider.VerificationStatus.VERIFIED
            ):
                return ServiceOrder.objects.none()

            consulta = ServiceOrder.objects.filter(
                status__in=(
                    ServiceOrder.Status.OPEN,
                    ServiceOrder.Status.NEGOTIATING,
                ),
                category__is_active=True,
                municipality__is_active=True,
                municipality__province__is_active=True,
            ).exclude(client=self.request.user)
            from apps.proposals.models import Proposal

            consulta = consulta.exclude(
                proposals__provider=prestador,
            )
            if prestador.coverage_areas.exists():
                consulta = consulta.filter(
                    municipality__provider_coverages__provider=prestador
                )
            id_categoria = self.request.query_params.get("category")
            if id_categoria is not None:
                if not id_categoria.isdecimal() or int(id_categoria) < 1:
                    raise ValidationError(
                        {"category": "Indica um identificador de categoria válido."}
                    )
                consulta = consulta.filter(category_id=id_categoria)
            id_municipio = self.request.query_params.get("municipality")
            if id_municipio is not None:
                if not id_municipio.isdecimal() or int(id_municipio) < 1:
                    raise ValidationError(
                        {"municipality": "Indica um identificador de município válido."}
                    )
                consulta = consulta.filter(municipality_id=id_municipio)
            pesquisa = self.request.query_params.get("search", "").strip()
            if pesquisa:
                consulta = consulta.filter(
                    Q(title__icontains=pesquisa) | Q(description__icontains=pesquisa)
                )
            return consulta.select_related("category", "municipality").distinct()

        if self.action in ("list", "retrieve", "cancel"):
            return ServiceOrder.objects.filter(client=self.request.user).select_related(
                "category",
                "municipality",
            )
        return ServiceOrder.objects.none()

    def get_serializer_class(self):
        if self.action == "opportunities":
            return OrderOpportunitySerializer
        if self.action == "cancel":
            return OrderStatusSerializer
        return super().get_serializer_class()

    def perform_create(self, serializer):
        if not self.request.user.is_active:
            raise PermissionDenied("A conta está inativa.")
        serializer.save()

    @extend_schema(responses={200: OrderOpportunitySerializer(many=True)})
    @action(detail=False, methods=("get",), url_path="opportunities")
    def opportunities(self, request):
        prestador = getattr(request.user, "provider", None)
        if prestador is None or not request.user.is_active:
            raise PermissionDenied(
                "É necessário um perfil de prestador ativo e verificado."
            )
        if prestador.verification_status != Provider.VerificationStatus.VERIFIED:
            raise PermissionDenied(
                "É necessário um perfil de prestador ativo e verificado."
            )
        consulta = self.filter_queryset(self.get_queryset())
        pagina = self.paginate_queryset(consulta)
        serializador = self.get_serializer(
            pagina if pagina is not None else consulta,
            many=True,
        )
        if pagina is not None:
            return self.get_paginated_response(serializador.data)
        return Response(serializador.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        pedido = cancelar_pedido(order_id=pk, actor=request.user)
        return Response(
            self.get_serializer(pedido).data,
            status=status.HTTP_200_OK,
        )
