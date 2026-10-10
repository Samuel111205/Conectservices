from rest_framework import serializers

from apps.proposals.models import Proposal

from .models import Conversation, Message, Notification
from .services import abrir_conversa, enviar_mensagem


class ConversationSerializer(serializers.ModelSerializer):
    proposal_id = serializers.IntegerField(read_only=True)
    order_id = serializers.IntegerField(source="proposal.order_id", read_only=True)
    order_title = serializers.CharField(source="proposal.order.title", read_only=True)
    proposal_status = serializers.CharField(source="proposal.status", read_only=True)
    provider_name = serializers.CharField(
        source="proposal.provider.commercial_name",
        read_only=True,
    )
    unread_count = serializers.IntegerField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = Conversation
        fields = (
            "id",
            "proposal_id",
            "order_id",
            "order_title",
            "proposal_status",
            "provider_name",
            "unread_count",
            "last_message_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class OpenConversationSerializer(serializers.Serializer):
    proposal_id = serializers.PrimaryKeyRelatedField(
        queryset=Proposal.objects.select_related("order", "provider__user"),
    )

    def create(self, dados_validados):
        conversa, criado = abrir_conversa(
            proposal_id=dados_validados["proposal_id"].pk,
            actor=self.context["request"].user,
        )
        self.was_created = criado
        return conversa

    def to_representation(self, instance):
        return ConversationSerializer(instance, context=self.context).data


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Message
        fields = ("id", "sender_id", "body", "created_at")
        read_only_fields = ("id", "sender_id", "created_at")

    def validate_body(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("A mensagem não pode estar vazia.")
        if len(normalized) > 5000:
            raise serializers.ValidationError(
                "A mensagem não pode exceder 5.000 caracteres."
            )
        return normalized

    def create(self, dados_validados):
        return enviar_mensagem(
            conversation_id=self.context["conversation_id"],
            actor=self.context["request"].user,
            body=dados_validados["body"],
        )


class NotificationSerializer(serializers.ModelSerializer):
    actor_id = serializers.IntegerField(read_only=True, allow_null=True)
    conversation_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "kind",
            "title",
            "body",
            "actor_id",
            "conversation_id",
            "created_at",
            "read_at",
        )
        read_only_fields = fields
