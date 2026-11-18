from django.contrib import admin

from .models import Booking, Dispute, DisputeMessage, DisputeStatusEvent


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "client",
        "provider",
        "final_price",
        "status",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("order__title", "client__email", "provider__commercial_name")
    readonly_fields = (
        "order",
        "proposal",
        "client",
        "provider",
        "service",
        "final_price",
        "currency",
        "status",
        "scheduled_at",
        "created_at",
        "updated_at",
        "completed_at",
        "cancellation_reason",
        "cancelled_by",
        "cancelled_at",
    )


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "category", "status", "opened_by", "created_at")
    list_filter = ("status", "category", "created_at")
    search_fields = ("booking__id", "opened_by__email", "description")
    readonly_fields = (
        "booking",
        "opened_by",
        "category",
        "description",
        "status",
        "resolution",
        "reviewed_by",
        "created_at",
        "updated_at",
        "resolved_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DisputeMessage)
class DisputeMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "dispute", "author", "created_at")
    search_fields = ("dispute__id", "author__email", "body")
    readonly_fields = ("dispute", "author", "body", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DisputeStatusEvent)
class DisputeStatusEventAdmin(admin.ModelAdmin):
    list_display = ("dispute", "previous_status", "new_status", "actor", "created_at")
    list_filter = ("new_status", "created_at")
    readonly_fields = ("dispute", "actor", "previous_status", "new_status", "note", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
