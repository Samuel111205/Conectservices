from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.providers.models import Provider

from .models import (
    LocationAuditEvent,
    Municipality,
    Province,
    ProviderCoverage,
    UserLocation,
)
from .permissions import PublicReadAdminWrite
from .serializers import (
    MunicipalitySerializer,
    ProvinceSerializer,
    ProviderCoverageSerializer,
    UserLocationSerializer,
)
from .services import (
    desativar_municipio,
    desativar_provincia,
    guardar_localizacao,
)


def validar_id_positivo(value, field_name):
    if not value.isdecimal() or int(value) < 1:
        raise ValidationError(
            {field_name: "Indica um identificador válido."}
        )


class ProvinceViewSet(viewsets.ModelViewSet):
    serializer_class = ProvinceSerializer
    permission_classes = (PublicReadAdminWrite,)
    http_method_names = ("get", "post", "patch", "put", "delete", "head", "options")

    def get_queryset(self):
        consulta = Province.objects.all()
        if not self.request.user.is_staff:
            consulta = consulta.filter(is_active=True)
        pesquisa = self.request.query_params.get("search", "").strip()
        if pesquisa:
            consulta = consulta.filter(Q(name__icontains=pesquisa) | Q(code__icontains=pesquisa))
        return consulta

    def perform_create(self, serializer):
        guardar_localizacao(
            serializer=serializer,
            actor=self.request.user,
            creating=True,
            entity_type=LocationAuditEvent.EntityType.PROVINCE,
        )

    def perform_update(self, serializer):
        guardar_localizacao(
            serializer=serializer,
            actor=self.request.user,
            creating=False,
            entity_type=LocationAuditEvent.EntityType.PROVINCE,
        )

    def perform_destroy(self, instance):
        desativar_provincia(province=instance, actor=self.request.user)


class MunicipalityViewSet(viewsets.ModelViewSet):
    serializer_class = MunicipalitySerializer
    permission_classes = (PublicReadAdminWrite,)
    http_method_names = ("get", "post", "patch", "put", "delete", "head", "options")

    def get_queryset(self):
        consulta = Municipality.objects.select_related("province")
        if not self.request.user.is_staff:
            consulta = consulta.filter(is_active=True, province__is_active=True)

        province_id = self.request.query_params.get("province")
        if province_id is not None:
            validar_id_positivo(province_id, "province")
            consulta = consulta.filter(province_id=province_id)

        pesquisa = self.request.query_params.get("search", "").strip()
        if pesquisa:
            consulta = consulta.filter(
                Q(name__icontains=pesquisa) | Q(province__name__icontains=pesquisa)
            )
        return consulta

    def perform_create(self, serializer):
        guardar_localizacao(
            serializer=serializer,
            actor=self.request.user,
            creating=True,
            entity_type=LocationAuditEvent.EntityType.MUNICIPALITY,
        )

    def perform_update(self, serializer):
        guardar_localizacao(
            serializer=serializer,
            actor=self.request.user,
            creating=False,
            entity_type=LocationAuditEvent.EntityType.MUNICIPALITY,
        )

    def perform_destroy(self, instance):
        desativar_municipio(municipality=instance, actor=self.request.user)


class UserLocationViewSet(viewsets.ModelViewSet):
    serializer_class = UserLocationSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return UserLocation.objects.none()
        consulta = UserLocation.objects.filter(user=self.request.user).select_related(
            "municipality",
            "municipality__province",
        )
        if self.request.query_params.get("include_inactive") != "true":
            consulta = consulta.filter(
                is_active=True,
                municipality__is_active=True,
                municipality__province__is_active=True,
            )
        return consulta

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))


class ProviderCoverageViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderCoverageSerializer
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "mine"):
            return (IsAuthenticated(),)
        return super().get_permissions()

    def get_queryset(self):
        consulta = ProviderCoverage.objects.select_related(
            "provider",
            "provider__user",
            "municipality",
            "municipality__province",
        )
        if self.action in ("update", "partial_update", "destroy", "mine"):
            prestador = getattr(self.request.user, "provider", None)
            if prestador is None:
                return consulta.none()
            return consulta.filter(provider=prestador)

        consulta_publica = consulta.filter(
            municipality__is_active=True,
            municipality__province__is_active=True,
            provider__verification_status=Provider.VerificationStatus.VERIFIED,
            provider__user__is_active=True,
        )
        if self.action == "retrieve":
            prestador = getattr(self.request.user, "provider", None)
            if prestador is not None:
                return consulta_publica.filter(pk=self.kwargs.get("pk")) | consulta.filter(
                    pk=self.kwargs.get("pk"),
                    provider=prestador,
                )
        province_id = self.request.query_params.get("province")
        if province_id is not None:
            validar_id_positivo(province_id, "province")
            consulta_publica = consulta_publica.filter(
                municipality__province_id=province_id
            )
        id_municipio = self.request.query_params.get("municipality")
        if id_municipio is not None:
            validar_id_positivo(id_municipio, "municipality")
            consulta_publica = consulta_publica.filter(municipality_id=id_municipio)
        return consulta_publica.order_by(
            "municipality__province__name",
            "municipality__name",
            "provider__commercial_name",
        )

    def perform_create(self, serializer):
        prestador = getattr(self.request.user, "provider", None)
        if prestador is None:
            raise PermissionDenied(
                "Cria primeiro o perfil de prestador para gerir áreas de atendimento."
            )
        serializer.save(provider=prestador)

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=False, methods=("get",), permission_classes=(IsAuthenticated,))
    def mine(self, request):
        consulta = self.filter_queryset(self.get_queryset())
        pagina = self.paginate_queryset(consulta)
        serializador = self.get_serializer(
            pagina if pagina is not None else consulta,
            many=True,
        )
        if pagina is not None:
            return self.get_paginated_response(serializador.data)
        return Response(serializador.data, status=status.HTTP_200_OK)
