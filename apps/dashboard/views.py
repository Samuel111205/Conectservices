from rest_framework import serializers
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from .models import ListingView
from .serializers import (
    AdminDashboardResponseSerializer,
    DashboardResponseSerializer,
    ListingViewSerializer,
    ProfessionalAnalyticsResponseSerializer,
)
from .services import (
    construir_analitica_profissional,
    construir_painel,
    construir_painel_administrativo,
    registar_visualizacao,
)


class ListingViewResponseSerializer(serializers.Serializer):
    recorded = serializers.BooleanField()
    listing_type = serializers.ChoiceField(choices=ListingView.ListingType.choices)


def _dias_do_periodo(valor):
    if valor is None:
        return 30
    try:
        dias = int(valor)
    except (TypeError, ValueError):
        raise serializers.ValidationError(
            {"period": "Escolhe um período de 7, 30 ou 90 dias."}
        )
    if dias not in (7, 30, 90):
        raise serializers.ValidationError(
            {"period": "Escolhe um período de 7, 30 ou 90 dias."}
        )
    return dias


class DashboardView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=DashboardResponseSerializer)
    def get(self, request):
        return Response(construir_painel(user=request.user))


class AdminDashboardView(APIView):
    permission_classes = (IsAdminUser,)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "period",
                OpenApiTypes.INT,
                enum=(7, 30, 90),
                default=30,
                description="Período de análise em dias.",
            )
        ],
        responses=AdminDashboardResponseSerializer,
    )
    def get(self, request):
        dias = _dias_do_periodo(request.query_params.get("period"))
        return Response(construir_painel_administrativo(periodo=dias))


class AnalyticsView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "period",
                OpenApiTypes.INT,
                enum=(7, 30, 90),
                default=30,
                description="Período de análise em dias.",
            )
        ],
        responses=ProfessionalAnalyticsResponseSerializer(allow_null=True),
    )
    def get(self, request):
        dias = _dias_do_periodo(request.query_params.get("period"))
        return Response(construir_analitica_profissional(user=request.user, periodo=dias))


class ListingViewEventView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "analytics_view"

    @extend_schema(
        request=ListingViewSerializer,
        responses={
            200: ListingViewResponseSerializer,
            201: ListingViewResponseSerializer,
        },
    )
    def post(self, request):
        serializer = ListingViewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _listing, created = registar_visualizacao(
            **serializer.validated_data,
            viewer=request.user,
        )
        return Response(
            {
                "recorded": created,
                "listing_type": serializer.validated_data["listing_type"],
            },
            status=201 if created else 200,
        )
