from django.contrib import admin, messages

from .email import enviar_email_notificacao
from .models import Conversation, Message, Notification, PushDeviceToken


@admin.action(description="Reenviar emails de notificação falhados")
def retry_notification_emails(modeladmin, request, queryset):
    selected_ids = list(
        queryset.filter(
            email_status__in=(
                Notification.EmailStatus.FAILED,
                Notification.EmailStatus.SENDING,
            )
        ).values_list("pk", flat=True)
    )
    Notification.objects.filter(pk__in=selected_ids).update(
        email_status=Notification.EmailStatus.FAILED,
        email_error="",
    )
    sent_count = 0
    failed_count = 0
    for notification_id in selected_ids:
        if enviar_email_notificacao(notification_id=notification_id):
            sent_count += 1
        else:
            failed_count += 1
    if sent_count:
        modeladmin.message_user(
            request,
            f"{sent_count} email(s) enviado(s).",
            level=messages.SUCCESS,
        )
    if failed_count:
        modeladmin.message_user(
            request,
            f"{failed_count} email(s) continuam por enviar; consulta os logs.",
            level=messages.ERROR,
        )


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    can_delete = False
    readonly_fields = ("sender", "body", "created_at")

    def has_add_permission(self, request, objeto=None):
        return False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "proposal", "created_at", "updated_at")
    search_fields = ("proposal__order__title", "proposal__provider__commercial_name")
    readonly_fields = ("proposal", "created_at", "updated_at")
    inlines = (MessageInline,)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, objeto=None):
        return False

    def has_delete_permission(self, request, objeto=None):
        return False


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "created_at")
    search_fields = ("body", "sender__email")
    readonly_fields = ("conversation", "sender", "body", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, objeto=None):
        return False

    def has_delete_permission(self, request, objeto=None):
        return False


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "recipient",
        "kind",
        "title",
        "email_status",
        "created_at",
        "read_at",
    )
    list_filter = ("kind", "email_status", "created_at", "read_at")
    search_fields = ("recipient__email", "title", "body")
    readonly_fields = (
        "recipient",
        "actor",
        "conversation",
        "message",
        "product_order",
        "kind",
        "title",
        "body",
        "email_status",
        "created_at",
        "read_at",
        "email_sent_at",
        "email_error",
    )

    actions = (retry_notification_emails,)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, objeto=None):
        return False


@admin.register(PushDeviceToken)
class PushDeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "is_active", "updated_at")
    list_filter = ("platform", "is_active")
    search_fields = ("user__email", "token")
    readonly_fields = ("user", "token", "platform", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, objeto=None):
        return False
