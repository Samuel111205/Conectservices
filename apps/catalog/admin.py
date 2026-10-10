from django.contrib import admin

from .models import CatalogAuditEvent, Category, Service
from .services import desativar_categoria, registar_alteracao_categoria


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")

    actions = ("deactivate_categories",)

    @admin.action(description="Desativar categorias selecionadas")
    def deactivate_categories(self, request, queryset):
        for categoria in queryset.filter(is_active=True):
            desativar_categoria(category=categoria, actor=request.user)

    def save_model(self, request, objeto, form, change):
        super().save_model(request, objeto, form, change)
        registar_alteracao_categoria(
            category=objeto,
            actor=request.user,
            action=(
                CatalogAuditEvent.Action.CATEGORY_UPDATED
                if change
                else CatalogAuditEvent.Action.CATEGORY_CREATED
            ),
        )

    def delete_model(self, request, objeto):
        desativar_categoria(category=objeto, actor=request.user)

    def delete_queryset(self, request, queryset):
        for categoria in queryset.filter(is_active=True):
            desativar_categoria(category=categoria, actor=request.user)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "provider",
        "category",
        "price_type",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "price_type", "category")
    search_fields = ("name", "provider__commercial_name", "description")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CatalogAuditEvent)
class CatalogAuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "action",
        "category_name_snapshot",
        "actor",
        "created_at",
    )
    list_filter = ("action",)
    search_fields = ("category_name_snapshot", "actor__email")
    readonly_fields = (
        "actor",
        "action",
        "category_id_snapshot",
        "category_name_snapshot",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, objeto=None):
        return False

    def has_delete_permission(self, request, objeto=None):
        return False
