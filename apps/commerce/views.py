from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.providers.models import Provider

from .models import Product, ProductOrder
from .serializers import (
    ProductOrderCreateSerializer,
    ProductOrderSerializer,
    ProductSerializer,
)
from .services import (
    aceitar_encomenda,
    cancelar_encomenda,
    concluir_encomenda,
    criar_encomenda,
    recusar_encomenda,
)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = (IsAuthenticatedOrReadOnly,)
    http_method_names = ("get", "post", "patch", "put", "delete", "head", "options")

    def get_permissions(self):
        if self.action in ("create", "mine", "update", "partial_update", "destroy"):
            return (IsAuthenticated(),)
        return (AllowAny(),)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Product.objects.none()
        consulta = Product.objects.select_related("provider", "category")
        if self.action in ("mine", "update", "partial_update", "destroy"):
            provider = getattr(self.request.user, "provider", None)
            return consulta.filter(provider=provider) if provider else consulta.none()

        publicos = consulta.filter(
            is_active=True,
            stock_quantity__gt=0,
            category__is_active=True,
            provider__verification_status=Provider.VerificationStatus.VERIFIED,
            provider__user__is_active=True,
        )
        if self.action == "retrieve":
            provider = getattr(self.request.user, "provider", None)
            if provider is not None:
                return (publicos.filter(pk=self.kwargs.get("pk")) | consulta.filter(
                    pk=self.kwargs.get("pk"), provider=provider,
                )).distinct()
            return publicos

        search = self.request.query_params.get("search", "").strip()
        if search:
            publicos = publicos.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(provider__commercial_name__icontains=search)
                | Q(category__name__icontains=search)
            )
        category_id = self.request.query_params.get("category")
        if category_id is not None and category_id.isdecimal():
            publicos = publicos.filter(category_id=category_id)
        return publicos.order_by("name", "pk")

    def perform_create(self, serializer):
        provider = getattr(self.request.user, "provider", None)
        if provider is None:
            raise PermissionDenied("Cria primeiro o perfil da empresa para gerir produtos.")
        serializer.save(provider=provider, currency="AOA")

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))

    @action(detail=False, methods=("get",), permission_classes=(IsAuthenticated,))
    def mine(self, request):
        provider = getattr(request.user, "provider", None)
        if provider is None:
            raise PermissionDenied("Cria primeiro o perfil da empresa para gerir produtos.")
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class ProductOrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProductOrderSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ProductOrder.objects.none()
        user = self.request.user
        queryset = ProductOrder.objects.filter(
            Q(buyer=user) | Q(provider__user=user)
        ).select_related(
            "buyer",
            "provider",
            "provider__user",
            "review",
        ).prefetch_related("items")
        return queryset

    def get_serializer_class(self):
        if self.action == "create":
            return ProductOrderCreateSerializer
        return ProductOrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = criar_encomenda(
            buyer=request.user,
            items=serializer.validated_data["items"],
            delivery_notes=serializer.validated_data.get("delivery_notes", ""),
        )
        return Response(
            ProductOrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=("post",))
    def accept(self, request, pk=None):
        order = aceitar_encomenda(order_id=pk, actor=request.user)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        order = recusar_encomenda(order_id=pk, actor=request.user)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=("post",))
    def complete(self, request, pk=None):
        order = concluir_encomenda(order_id=pk, actor=request.user)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        order = cancelar_encomenda(order_id=pk, actor=request.user)
        return Response(self.get_serializer(order).data)
