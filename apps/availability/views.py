from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.providers.models import Provider

from .models import WeeklyAvailability
from .serializers import WeeklyAvailabilitySerializer
from .services import eliminar_disponibilidade_semanal


class WeeklyAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = WeeklyAvailabilitySerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WeeklyAvailability.objects.none()
        prestador = getattr(self.request.user, "provider", None)
        if prestador is None:
            return WeeklyAvailability.objects.none()
        return WeeklyAvailability.objects.filter(provider=prestador)

    def perform_create(self, serializer):
        prestador = getattr(self.request.user, "provider", None)
        if prestador is None:
            raise PermissionDenied(
                "Cria primeiro o perfil de prestador para gerir a disponibilidade."
            )
        if not self.request.user.is_active:
            raise PermissionDenied("A conta está inativa.")
        serializer.save()

    def perform_destroy(self, instance):
        prestador = getattr(self.request.user, "provider", None)
        if prestador is None or instance.provider_id != prestador.pk:
            raise PermissionDenied("Só podes gerir a tua própria disponibilidade.")
        eliminar_disponibilidade_semanal(provider=prestador, instance=instance)
