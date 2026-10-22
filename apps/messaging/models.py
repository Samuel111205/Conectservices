from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models

from apps.commerce.models import ProductOrder
from apps.proposals.models import Proposal


class Conversation(models.Model):
    proposal = models.OneToOneField(
        Proposal,
        on_delete=models.PROTECT,
        related_name="conversation",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-id")
        verbose_name = "conversa"
        verbose_name_plural = "conversas"

    def __str__(self):
        return f"Conversa da proposta #{self.proposal_id}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_messages",
    )
    body = models.TextField(validators=(MaxLengthValidator(5000),))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "mensagem"
        verbose_name_plural = "mensagens"
        indexes = [
            models.Index(
                fields=("conversation", "-created_at", "-id"),
                name="message_conv_created_idx",
            ),
        ]

    def __str__(self):
        return f"Mensagem #{self.pk} — conversa #{self.conversation_id}"


class Notification(models.Model):
    class Kind(models.TextChoices):
        MESSAGE = "MESSAGE", "Nova mensagem"
        PRODUCT_ORDER = "PRODUCT_ORDER", "Atualização de encomenda"

    class EmailStatus(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        SENDING = "SENDING", "A enviar"
        SENT = "SENT", "Enviado"
        FAILED = "FAILED", "Falhou"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="in_app_notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_notifications",
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    product_order = models.ForeignKey(
        ProductOrder,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=500)
    email_status = models.CharField(
        max_length=12,
        choices=EmailStatus.choices,
        default=EmailStatus.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    email_error = models.CharField(max_length=160, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "notificação"
        verbose_name_plural = "notificações"
        indexes = [
            models.Index(
                fields=("recipient", "read_at", "-created_at"),
                name="notif_recipient_read_date_idx",
            ),
            models.Index(
                fields=("email_status", "created_at"),
                name="notif_email_status_date_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        kind="MESSAGE",
                        conversation__isnull=False,
                        message__isnull=False,
                        product_order__isnull=True,
                    )
                    | models.Q(
                        kind="PRODUCT_ORDER",
                        conversation__isnull=True,
                        message__isnull=True,
                        product_order__isnull=False,
                    )
                ),
                name="notification_target_matches_kind",
            ),
        ]

    def __str__(self):
        return f"{self.title} — {self.recipient}"


class PushDeviceToken(models.Model):
    class Platform(models.TextChoices):
        ANDROID = "ANDROID", "Android"
        IOS = "IOS", "iOS"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_device_tokens",
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=8, choices=Platform.choices)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-id")
        verbose_name = "dispositivo de notificações"
        verbose_name_plural = "dispositivos de notificações"

    def __str__(self):
        return f"{self.platform} — {self.user}"
