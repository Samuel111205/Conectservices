from django.contrib import admin

from .models import BusinessProfile


@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ("provider", "registered_name", "website", "updated_at")
    search_fields = (
        "provider__commercial_name",
        "provider__user__email",
        "registered_name",
    )
    readonly_fields = ("created_at", "updated_at")
    fields = (
        "provider",
        "registered_name",
        "logo",
        "website",
        "address",
        "opening_hours",
        "created_at",
        "updated_at",
    )
