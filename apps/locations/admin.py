from django.contrib import admin

from .models import (
    LocationAuditEvent,
    Municipality,
    Province,
    ProviderCoverage,
    UserLocation,
)
from .services import (
    desativar_municipio,
    desativar_provincia,
    registar_alteracao_localizacao,
)


@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "code")
    readonly_fields = ("created_at", "updated_at")
    actions = ("deactivate_provinces",)

    @admin.action(description="Desativar províncias selecionadas")
    def deactivate_provinces(self, request, queryset):
        for provincia in queryset.filter(is_active=True):
            desativar_provincia(province=provincia, actor=request.user)

    def save_model(self, request, objeto, form, change):
        super().save_model(request, objeto, form, change)
        registar_alteracao_localizacao(
            entity=objeto,
            entity_type=LocationAuditEvent.EntityType.PROVINCE,
            actor=request.user,
            action=(
                LocationAuditEvent.Action.UPDATED
                if change
                else LocationAuditEvent.Action.CREATED
            ),
        )

    def delete_model(self, request, objeto):
        desativar_provincia(province=objeto, actor=request.user)

    def delete_queryset(self, request, queryset):
        for provincia in queryset.filter(is_active=True):
            desativar_provincia(province=provincia, actor=request.user)


@admin.register(Municipality)
class MunicipalityAdmin(admin.ModelAdmin):
    list_display = ("name", "province", "is_active", "updated_at")
    list_filter = ("province", "is_active")
    search_fields = ("name", "province__name")
    readonly_fields = ("created_at", "updated_at")
    actions = ("deactivate_municipalities",)

    @admin.action(description="Desativar municípios selecionados")
    def deactivate_municipalities(self, request, queryset):
        for municipio in queryset.filter(is_active=True):
            desativar_municipio(municipality=municipio, actor=request.user)

    def save_model(self, request, objeto, form, change):
        super().save_model(request, objeto, form, change)
        registar_alteracao_localizacao(
            entity=objeto,
            entity_type=LocationAuditEvent.EntityType.MUNICIPALITY,
            actor=request.user,
            action=(
                LocationAuditEvent.Action.UPDATED
                if change
                else LocationAuditEvent.Action.CREATED
            ),
        )

    def delete_model(self, request, objeto):
        desativar_municipio(municipality=objeto, actor=request.user)

    def delete_queryset(self, request, queryset):
        for municipio in queryset.filter(is_active=True):
            desativar_municipio(municipality=municipio, actor=request.user)


@admin.register(ProviderCoverage)
class ProviderCoverageAdmin(admin.ModelAdmin):
    list_display = ("provider", "municipality", "radius_km", "updated_at")
    list_filter = ("municipality__province",)
    search_fields = ("provider__commercial_name", "municipality__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(UserLocation)
class UserLocationAdmin(admin.ModelAdmin):
    list_display = ("label", "user", "municipality", "is_active", "updated_at")
    list_filter = ("municipality__province", "is_active")
    search_fields = ("user__email", "label", "neighborhood", "address")
    readonly_fields = ("created_at", "updated_at")


@admin.register(LocationAuditEvent)
class LocationAuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "entity_type",
        "entity_name_snapshot",
        "action",
        "actor",
        "created_at",
    )
    list_filter = ("entity_type", "action")
    search_fields = ("entity_name_snapshot", "actor__email")
    readonly_fields = (
        "actor",
        "entity_type",
        "entity_id_snapshot",
        "entity_name_snapshot",
        "action",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, objeto=None):
        return False

    def has_delete_permission(self, request, objeto=None):
        return False
