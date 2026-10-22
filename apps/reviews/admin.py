from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "product_order", "rating", "created_at")
    list_filter = ("rating", "created_at")
    search_fields = (
        "booking__id",
        "booking__provider__commercial_name",
        "product_order__id",
        "product_order__provider__commercial_name",
    )
    readonly_fields = ("booking", "product_order", "created_at")
