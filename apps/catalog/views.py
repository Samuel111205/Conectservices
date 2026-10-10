from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.providers.models import Provider

from .models import CatalogAuditEvent, Category, Service
from .permissions import PublicReadAdminWrite
from .serializers import CategorySerializer, ServiceSerializer
from .services import desativar_categoria, registar_alteracao_categoria, guardar_categoria


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = (PublicReadAdminWrite,)
    http_method_names = ("get", "post", "patch", "put", "delete", "head", "options")

    def get_queryset(self):
        consulta = Category.objects.select_related("parent")
        if not self.request.user.is_staff:
            consulta = consulta.filter(is_active=True)

        parent_id = self.request.query_params.get("parent")
        if parent_id is not None:
            if parent_id == "null":
                consulta = consulta.filter(parent__isnull=True)
            else:
                if not parent_id.isdecimal() or int(parent_id) < 1:
                    raise ValidationError(
                        {"parent": "Indica um identificador de categoria válido."}
                    )
                consulta = consulta.filter(parent_id=parent_id)

        pesquisa = self.request.query_params.get("search", "").strip()
        if pesquisa:
            consulta = consulta.filter(
                Q(name__icontains=pesquisa) | Q(description__icontains=pesquisa)
            )
        return consulta

    def perform_create(self, serializer):
        guardar_categoria(serializer=serializer, actor=self.request.user, creating=True)

    def perform_update(self, serializer):
        guardar_categoria(serializer=serializer, actor=self.request.user, creating=False)

    def perform_destroy(self, instance):
        desativar_categoria(category=instance, actor=self.request.user)


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = (IsAuthenticatedOrReadOnly,)
    http_method_names = ("get", "post", "patch", "put", "delete", "head", "options")

    def get_queryset(self):
        consulta = Service.objects.select_related(
            "provider",
            "provider__user",
            "category",
        )
        if self.action in ("update", "partial_update", "destroy", "mine"):
            prestador = getattr(self.request.user, "provider", None)
            if prestador is None:
                return consulta.none()
            return consulta.filter(provider=prestador)

        id_categoria = self.request.query_params.get("category")
        if id_categoria is not None and (
            not id_categoria.isdecimal() or int(id_categoria) < 1
        ):
            raise ValidationError(
                {"category": "Indica um identificador de categoria válido."}
            )

        id_prestador = self.request.query_params.get("provider")
        if id_prestador is not None and (
            not id_prestador.isdecimal() or int(id_prestador) < 1
        ):
            raise ValidationError(
                {"provider": "Indica um identificador de prestador válido."}
            )

        consulta_publica = consulta.filter(
            is_active=True,
            category__is_active=True,
            provider__verification_status=Provider.VerificationStatus.VERIFIED,
            provider__user__is_active=True,
        )
        if self.action == "retrieve":
            prestador = getattr(self.request.user, "provider", None)
            if prestador is not None:
                own_service = consulta.filter(
                    pk=self.kwargs.get("pk"),
                    provider=prestador,
                )
                return consulta_publica.filter(pk=self.kwargs.get("pk")) | own_service

        id_categoria = self.request.query_params.get("category")
        if id_categoria is not None:
            consulta_publica = consulta_publica.filter(category_id=id_categoria)

        id_prestador = self.request.query_params.get("provider")
        if id_prestador is not None:
            consulta_publica = consulta_publica.filter(provider_id=id_prestador)

        pesquisa = self.request.query_params.get("search", "").strip()
        if pesquisa:
            consulta_publica = consulta_publica.filter(
                Q(name__icontains=pesquisa) | Q(description__icontains=pesquisa)
            )

        return consulta_publica.order_by("name", "id")

    def get_permissions(self):
        if self.action in ("create", "mine", "update", "partial_update", "destroy"):
            return (IsAuthenticated(),)
        return super().get_permissions()

    def perform_create(self, serializer):
        prestador = getattr(self.request.user, "provider", None)
        if prestador is None:
            raise PermissionDenied("Cria primeiro o perfil de prestador para gerir serviços.")
        serializer.save(provider=prestador)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))

    @extend_schema(responses={200: ServiceSerializer(many=True)})
    @action(detail=False, methods=("get",), permission_classes=(IsAuthenticated,))
    def mine(self, request):
        consulta = self.filter_queryset(self.get_queryset())
        pagina = self.paginate_queryset(consulta)
        serializador = self.get_serializer(pagina if pagina is not None else consulta, many=True)
        if pagina is not None:
            return self.get_paginated_response(serializador.data)
        return Response(serializador.data, status=status.HTTP_200_OK)
