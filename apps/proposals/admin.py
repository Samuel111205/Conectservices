from django.contrib import admin

from .models import Proposal


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "provider",
        "price",
        "status",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("order__title", "provider__commercial_name")
    readonly_fields = (
        "order",
        "provider",
        "service",
        "price",
        "currency",
        "description",
        "estimated_days",
        "created_at",
        "updated_at",
    )
