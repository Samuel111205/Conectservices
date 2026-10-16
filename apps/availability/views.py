from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated

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

        provider_id = self.request.query_params.get("provider")
        if provider_id is not None:
            if not provider_id.isdecimal() or int(provider_id) < 1:
                raise ValidationError({"provider": "Indica um prestador válido."})
            return WeeklyAvailability.objects.filter(
                provider_id=int(provider_id),
                provider__verification_status=Provider.VerificationStatus.VERIFIED,
                provider__user__is_active=True,
            )

        prestador = getattr(self.request.user, "provider", None)
        if prestador is None:
            return WeeklyAvailability.objects.none()
        return WeeklyAvailability.objects.filter(provider=prestador)

    def get_permissions(self):
        if self.action == "list":
            return (AllowAny(),)
        return super().get_permissions()

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
