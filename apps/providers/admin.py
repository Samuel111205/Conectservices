from django.contrib import admin
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import Provider, ProviderVerificationDocument


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = (
        "commercial_name",
        "user",
        "verification_status",
        "verification_submitted_at",
        "verified_at",
        "created_at",
    )
    list_filter = ("verification_status",)
    search_fields = ("commercial_name", "user__email", "business_email")
    readonly_fields = ("created_at", "updated_at")
    actions = ("aprovar_candidaturas", "rejeitar_candidaturas")
    fieldsets = (
        (
            "Prestador",
            {
                "fields": (
                    "user",
                    "commercial_name",
                    "description",
                    "business_phone",
                    "business_email",
                )
            },
        ),
        (
            "Verificação",
            {
                "fields": (
                    "verification_status",
                    "verification_submitted_at",
                    "verification_feedback",
                    "verified_at",
                )
            },
        ),
        ("Datas", {"fields": ("created_at", "updated_at")}),
    )

    def save_model(self, request, objeto, form, change):
        if objeto.verification_status == Provider.VerificationStatus.VERIFIED:
            if objeto.verified_at is None:
                objeto.verified_at = timezone.now()
            objeto.verification_feedback = ""
        else:
            objeto.verified_at = None
        super().save_model(request, objeto, form, change)

    @admin.action(description="Aprovar candidaturas selecionadas")
    def aprovar_candidaturas(self, request, queryset):
        agora = timezone.now()
        atualizadas = 0
        for prestador in queryset:
            prestador.verification_status = Provider.VerificationStatus.VERIFIED
            prestador.verified_at = agora
            prestador.verification_feedback = ""
            prestador.save(
                update_fields=(
                    "verification_status",
                    "verified_at",
                    "verification_feedback",
                    "updated_at",
                )
            )
            atualizadas += 1
        self.message_user(
            request,
            f"{atualizadas} candidatura(s) aprovada(s).",
            messages.SUCCESS,
        )

    @admin.action(description="Rejeitar candidaturas selecionadas")
    def rejeitar_candidaturas(self, request, queryset):
        atualizadas = 0
        for prestador in queryset:
            prestador.verification_status = Provider.VerificationStatus.REJECTED
            prestador.verified_at = None
            prestador.verification_feedback = (
                "A candidatura precisa de ajustes. Atualiza os documentos e "
                "submete novamente para revisão."
            )
            prestador.save(
                update_fields=(
                    "verification_status",
                    "verified_at",
                    "verification_feedback",
                    "updated_at",
                )
            )
            atualizadas += 1
        self.message_user(
            request,
            f"{atualizadas} candidatura(s) rejeitada(s).",
            messages.WARNING,
        )


@admin.register(ProviderVerificationDocument)
class ProviderVerificationDocumentAdmin(admin.ModelAdmin):
    list_display = ("provider", "document_type", "uploaded_at", "download_link")
    list_filter = ("document_type", "uploaded_at")
    search_fields = (
        "provider__commercial_name",
        "provider__user__email",
    )
    readonly_fields = ("provider", "document_type", "uploaded_at", "download_link")
    fields = ("provider", "document_type", "uploaded_at", "download_link")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def get_urls(self):
        custom_urls = [
            path(
                "<int:document_id>/download/",
                self.admin_site.admin_view(self.download_document),
                name="providers_providerverificationdocument_download",
            )
        ]
        return custom_urls + super().get_urls()

    @admin.display(description="Documento privado")
    def download_link(self, obj):
        if obj is None:
            return "Disponível apenas para administradores."
        url = reverse(
            "admin:providers_providerverificationdocument_download",
            args=(obj.pk,),
        )
        return format_html('<a href="{}">Transferir documento</a>', url)

    def download_document(self, request, document_id):
        documento = get_object_or_404(ProviderVerificationDocument, pk=document_id)
        if not self.has_view_permission(request, documento):
            raise PermissionDenied
        documento.file.open("rb")
        resposta = FileResponse(
            documento.file,
            as_attachment=True,
            filename=documento.file.name.rsplit("/", 1)[-1],
            content_type="application/octet-stream",
        )
        resposta["X-Content-Type-Options"] = "nosniff"
        resposta["Cache-Control"] = "private, no-store"
        return resposta
