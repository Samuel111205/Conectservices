from django.contrib import admin, messages
from rest_framework.exceptions import APIException

from .models import Payment
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
