from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .dispute_serializers import (
    DisputeCreateSerializer,
    DisputeMessageCreateSerializer,
    DisputeMessageSerializer,
    DisputeReviewSerializer,
    DisputeSerializer,
)
from .models import Dispute, DisputeMessage
from .services import avaliar_disputa


class DisputeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DisputeSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Dispute.objects.none()
        utilizador = self.request.user
        queryset = Dispute.objects.select_related(
            "booking__client", "booking__provider__user", "opened_by", "reviewed_by"
        )
        if utilizador.is_staff:
            return queryset
        return queryset.filter(
            Q(booking__client=utilizador) | Q(booking__provider__user=utilizador)
        )

    def get_serializer_class(self):
        if self.action == "create":
            return DisputeCreateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        self.dispute = serializer.save()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = DisputeSerializer(self.dispute, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request=DisputeMessageCreateSerializer,
        responses={200: DisputeMessageSerializer, 201: DisputeMessageSerializer},
    )
    @action(detail=True, methods=("get", "post"))
    def messages(self, request, pk=None):
        disputa = self.get_object()
        if request.method == "GET":
            mensagens = DisputeMessage.objects.filter(dispute=disputa).select_related("author")
            pagina = self.paginate_queryset(mensagens)
            if pagina is not None:
                return self.get_paginated_response(
                    DisputeMessageSerializer(pagina, many=True).data
                )
            return Response(DisputeMessageSerializer(mensagens, many=True).data)
        serializador = DisputeMessageCreateSerializer(
            data=request.data,
            context={"request": request, "dispute_id": disputa.pk},
        )
        serializador.is_valid(raise_exception=True)
        mensagem = serializador.save()
        return Response(DisputeMessageSerializer(mensagem).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=DisputeReviewSerializer, responses=DisputeSerializer)
    @action(detail=True, methods=("post",), url_path="review")
    def review(self, request, pk=None):
        if not request.user.is_staff:
            raise PermissionDenied("Só a equipa de apoio pode rever disputas.")
        serializer = DisputeReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        disputa = avaliar_disputa(
            dispute_id=pk,
            actor=request.user,
            status=serializer.validated_data["status"],
            resolution=serializer.validated_data.get("resolution", ""),
        )
        return Response(DisputeSerializer(disputa, context=self.get_serializer_context()).data)
