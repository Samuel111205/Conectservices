from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FavoriteProvider, FavoriteService
from .serializers import FavoriteProviderSerializer, FavoriteServiceSerializer


class FavoriteViewSetMixin:
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "delete", "head", "options")

    def create(self, request, *args, **kwargs):
        serializador = self.get_serializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        favorite = serializador.save()
        headers = self.get_success_headers(serializador.data)
        response_status = (
            status.HTTP_201_CREATED if serializador.was_created else status.HTTP_200_OK
        )
        return Response(serializador.data, status=response_status, headers=headers)


class FavoriteProviderViewSet(
    FavoriteViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = FavoriteProviderSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FavoriteProvider.objects.none()
        return FavoriteProvider.objects.filter(
            user=self.request.user,
        ).select_related("provider")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FavoriteServiceViewSet(
    FavoriteViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = FavoriteServiceSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return FavoriteService.objects.none()
        return FavoriteService.objects.filter(
            user=self.request.user,
        ).select_related(
            "service",
            "service__provider",
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
