from django.contrib import admin

from .models import Booking


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
        "scheduled_at",
        "created_at",
        "updated_at",
        "completed_at",
    )
