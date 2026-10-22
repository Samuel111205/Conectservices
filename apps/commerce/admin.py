from django.contrib import admin

from .models import Product, ProductOrder, ProductOrderItem


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "provider", "category", "price", "stock_quantity", "is_active")
    list_filter = ("is_active", "category")
    search_fields = ("name", "provider__commercial_name", "description")
    readonly_fields = ("created_at", "updated_at")


class ProductOrderItemInline(admin.TabularInline):
    model = ProductOrderItem
    extra = 0
    readonly_fields = ("product", "product_name", "unit_price", "quantity")
    can_delete = False


@admin.register(ProductOrder)
class ProductOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "buyer", "status", "total_amount", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("provider__commercial_name", "buyer__email")
    readonly_fields = ("buyer", "provider", "total_amount", "currency", "created_at", "updated_at")
    inlines = (ProductOrderItemInline,)
