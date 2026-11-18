from django.contrib import admin, messages
from rest_framework.exceptions import APIException

from .models import Payment, PaymentAuditEvent, RefundAuditEvent, RefundRequest
from .services import avaliar_pagamento


@admin.action(description="Confirmar pagamentos selecionados")
def confirm_payments(modeladmin, request, queryset):
    _review_selected(modeladmin, request, queryset, Payment.Status.CONFIRMED)


@admin.action(description="Rejeitar pagamentos selecionados")
def reject_payments(modeladmin, request, queryset):
    _review_selected(modeladmin, request, queryset, Payment.Status.REJECTED)


def _review_selected(modeladmin, request, queryset, status):
    reviewed = 0
    for pagamento in queryset:
        try:
            avaliar_pagamento(payment_id=pagamento.pk, actor=request.user, status=status)
        except APIException as exc:
            modeladmin.message_user(
                request,
                f"Pagamento #{pagamento.pk}: {exc.detail}",
                level=messages.ERROR,
            )
        else:
            reviewed += 1
    if reviewed:
        modeladmin.message_user(
            request,
            f"{reviewed} pagamento(s) revisto(s).",
            level=messages.SUCCESS,
        )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "booking",
        "amount",
        "currency",
        "method",
        "status",
        "created_at",
        "reviewed_at",
    )
    list_filter = ("status", "method", "created_at")
    search_fields = ("booking__id", "external_reference")
    readonly_fields = (
        "booking",
        "amount",
        "currency",
        "method",
        "external_reference",
        "status",
        "reviewed_by",
        "created_at",
        "reviewed_at",
    )
    actions = (confirm_payments, reject_payments)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, objeto=None):
        return False


@admin.register(PaymentAuditEvent)
class PaymentAuditEventAdmin(admin.ModelAdmin):
    list_display = ("payment", "previous_status", "new_status", "actor", "created_at")
    list_filter = ("new_status", "created_at")
    search_fields = ("payment__id", "actor__email")
    readonly_fields = (
        "payment",
        "actor",
        "previous_status",
        "new_status",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RefundRequest)
class RefundRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "payment",
        "amount",
        "status",
        "requested_by",
        "created_at",
        "refunded_at",
    )
    list_filter = ("status", "created_at", "reviewed_at")
    search_fields = ("payment__booking__id", "requested_by__email", "payout_reference")
    readonly_fields = (
        "payment",
        "requested_by",
        "amount",
        "reason",
        "status",
        "decision_note",
        "reviewed_by",
        "payout_reference",
        "created_at",
        "updated_at",
        "reviewed_at",
        "refunded_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RefundAuditEvent)
class RefundAuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "refund_request",
        "previous_status",
        "new_status",
        "actor",
        "created_at",
    )
    list_filter = ("new_status", "created_at")
    readonly_fields = (
        "refund_request",
        "actor",
        "previous_status",
        "new_status",
        "note",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
