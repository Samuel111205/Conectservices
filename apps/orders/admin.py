from django.contrib import admin

from .models import ServiceOrder


@admin.register(ServiceOrder)
class ServiceOrderAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "client",
        "category",
        "municipality_name_snapshot",
        "status",
        "created_at",
    )
    list_filter = ("status", "category", "province_name_snapshot")
    search_fields = ("title", "description", "client__email")
    readonly_fields = (
        "client",
        "category",
        "municipality",
        "municipality_name_snapshot",
        "province_name_snapshot",
        "neighborhood_snapshot",
        "address_snapshot",
        "latitude_snapshot",
        "longitude_snapshot",
        "created_at",
        "updated_at",
    )
