from django.db.models import Count, OuterRef, Q, Subquery
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal

from .models import Conversation, Message, Notification
from .serializers import (
    ConversationSerializer,
    DeactivatePushTokenSerializer,
    MessageSerializer,
    NotificationSerializer,
    OpenConversationSerializer,
    PushDeviceTokenSerializer,
)
from .services import (
    marcar_todas_notificacoes_como_lidas,
    marcar_notificacoes_conversa_como_lidas,
    marcar_notificacao_como_lida,
    desativar_dispositivo_push,
)


class ConversationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ConversationSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_serializer_class(self):
        if self.action == "create":
            return OpenConversationSerializer
        if self.action == "messages":
            return MessageSerializer
        return ConversationSerializer

    def create(self, request, *args, **kwargs):
        serializador = self.get_serializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        conversa = serializador.save()
        response_status = (
            status.HTTP_201_CREATED if serializador.was_created else status.HTTP_200_OK
        )
        return Response(
            ConversationSerializer(
                self.get_queryset().get(pk=conversa.pk),
                context=self.get_serializer_context(),
            ).data,
            status=response_status,
        )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Conversation.objects.none()
        utilizador = self.request.user
        last_message = Message.objects.filter(
            conversation_id=OuterRef("pk"),
        ).order_by("-created_at", "-pk").values("created_at")[:1]
        last_message_preview = Message.objects.filter(
            conversation_id=OuterRef("pk"),
        ).order_by("-created_at", "-pk").values("body")[:1]
        return Conversation.objects.filter(
            Q(proposal__order__client=utilizador)
            | Q(proposal__provider__user=utilizador)
        ).select_related(
            "proposal",
            "proposal__order",
            "proposal__order__client",
            "proposal__provider",
        ).annotate(
            unread_count=Count(
                "notifications",
                filter=Q(
                    notifications__recipient=utilizador,
                    notifications__read_at__isnull=True,
                ),
                distinct=True,
            ),
            last_message_at=Subquery(last_message),
            last_message_preview=Subquery(last_message_preview),
        ).order_by("-updated_at", "-pk")

    @action(detail=True, methods=("get", "post"))
    def messages(self, request, pk=None):
        conversa = self.get_object()
        if request.method == "GET":
            marcar_notificacoes_conversa_como_lidas(
                conversation_id=conversa.pk,
                user=request.user,
            )
            consulta = Message.objects.filter(
                conversation=conversa,
            ).select_related("sender")
            pagina = self.paginate_queryset(consulta)
            serializador = MessageSerializer(
                pagina if pagina is not None else consulta,
                many=True,
                context=self.get_serializer_context(),
            )
            if pagina is not None:
                return self.get_paginated_response(serializador.data)
            return Response(serializador.data)

        serializador = MessageSerializer(
            data=request.data,
            context={
                **self.get_serializer_context(),
                "conversation_id": conversa.pk,
            },
        )
        serializador.is_valid(raise_exception=True)
        mensagem = serializador.save()
        return Response(
            MessageSerializer(mensagem, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )
class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        return Notification.objects.filter(
            recipient=self.request.user,
        ).select_related("conversation", "actor", "product_order__provider")

    @action(detail=False, methods=("get",))
    def unread_count(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=("post",))
    def read_all(self, request):
        count = marcar_todas_notificacoes_como_lidas(user=request.user)
        return Response({"marked_read": count})

    @action(detail=True, methods=("post",))
    def read(self, request, pk=None):
        notificacao = self.get_object()
        notificacao = marcar_notificacao_como_lida(
            notification=notificacao,
            user=request.user,
        )
        return Response(self.get_serializer(notificacao).data)


class PushDeviceTokenViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = PushDeviceTokenSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "head", "options")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        device = serializer.save()
        return Response(
            self.get_serializer(device).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=("post",))
    def deactivate(self, request):
        serializer = DeactivatePushTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = desativar_dispositivo_push(
            user=request.user,
            token=serializer.validated_data["token"],
        )
        return Response({"deactivated": bool(count)})
