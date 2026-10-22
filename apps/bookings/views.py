from datetime import date
import re

from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.availability.services import (
    horarios_disponiveis_contratacao,
    agendar_contratacao,
)
from .models import Booking
from .serializers import BookingSerializer
from .services import (
    cancelar_contratacao,
    concluir_contratacao,
    confirmar_contratacao,
    iniciar_contratacao,
)


class ScheduleBookingSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()

    def validate_scheduled_at(self, value):
        raw_value = self.initial_data.get("scheduled_at")
        if isinstance(raw_value, str) and not re.search(
            r"(?:Z|[+-]\d{2}:\d{2})$",
            raw_value.strip(),
        ):
            raise serializers.ValidationError(
                "Indica a data e hora com fuso horário, por exemplo +01:00."
            )
        return value

    def validate(self, atributos):
        fornecido = set(self.initial_data).difference({"scheduled_at"})
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Só podes escolher a data e hora da contratação." for campo in fornecido}
            )
        return atributos


class BookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = BookingSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Booking.objects.none()
        utilizador = self.request.user
        return Booking.objects.filter(
            Q(client=utilizador) | Q(provider__user=utilizador)
        ).select_related("order", "proposal", "provider", "service", "review")

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        contratacao = confirmar_contratacao(booking_id=pk, actor=request.user)
        return Response(self.get_serializer(contratacao).data)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
            )
        ],
        responses=OpenApiTypes.OBJECT,
    )
    @action(detail=True, methods=("get",), url_path="available-slots")
    def available_slots(self, request, pk=None):
        raw_date = request.query_params.get("date", "")
        try:
            if len(raw_date) != 10:
                raise ValueError
            slot_date = date.fromisoformat(raw_date)
        except ValueError as exc:
            raise ValidationError(
                {"date": "Indica a data no formato AAAA-MM-DD."}
            ) from exc

        contratacao, slots = horarios_disponiveis_contratacao(
            booking_id=pk,
            actor=request.user,
            day=slot_date,
        )
        return Response(
            {
                "date": slot_date.isoformat(),
                "duration_minutes": contratacao.duration_minutes,
                "timezone": "Africa/Luanda",
                "slots": [slot.isoformat() for slot in slots],
            }
        )

    @extend_schema(
        request=ScheduleBookingSerializer,
        responses=BookingSerializer,
    )
    @action(detail=True, methods=("post",))
    def schedule(self, request, pk=None):
        serializador = ScheduleBookingSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        contratacao = agendar_contratacao(
            booking_id=pk,
            actor=request.user,
            scheduled_at=serializador.validated_data["scheduled_at"],
        )
        return Response(self.get_serializer(contratacao).data)

    @action(detail=True, methods=("post",), url_path="start")
    def start(self, request, pk=None):
        contratacao = iniciar_contratacao(booking_id=pk, actor=request.user)
        return Response(self.get_serializer(contratacao).data)

    @action(detail=True, methods=("post",))
    def complete(self, request, pk=None):
        contratacao = concluir_contratacao(booking_id=pk, actor=request.user)
        return Response(self.get_serializer(contratacao).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        contratacao = cancelar_contratacao(booking_id=pk, actor=request.user)
        return Response(self.get_serializer(contratacao).data)
