from django.contrib import admin

from .models import FavoriteProvider, FavoriteService


@admin.register(FavoriteProvider)
class FavoriteProviderAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "created_at")
    search_fields = ("user__email", "provider__commercial_name")
    readonly_fields = ("user", "provider", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, objeto=None):
        return False


@admin.register(FavoriteService)
class FavoriteServiceAdmin(admin.ModelAdmin):
    list_display = ("user", "service", "created_at")
    search_fields = ("user__email", "service__name", "service__provider__commercial_name")
    readonly_fields = ("user", "service", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, objeto=None):
        return False
