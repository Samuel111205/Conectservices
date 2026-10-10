from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone

from .validators import validate_verification_document


def private_verification_storage():
    from django.core.files.storage import storages

    return storages["verification_documents"]


def verification_document_upload_to(instance, filename):
    return f"providers/{instance.provider_id}/verification/{filename}"


class Provider(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        VERIFIED = "VERIFIED", "Verificado"
        REJECTED = "REJECTED", "Rejeitado"
        SUSPENDED = "SUSPENDED", "Suspenso"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="provider",
    )
    commercial_name = models.CharField(max_length=160)
    description = models.TextField(
        blank=True,
        validators=(MaxLengthValidator(5000),),
    )
    business_phone = models.CharField(max_length=32, blank=True)
    business_email = models.EmailField(blank=True)
    verification_status = models.CharField(
        max_length=16,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_submitted_at = models.DateTimeField(null=True, blank=True)
    verification_feedback = models.TextField(
        blank=True,
        validators=(MaxLengthValidator(2000),),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "prestador"
        verbose_name_plural = "prestadores"

    def __str__(self):
        return self.commercial_name

    def mark_verified(self):
        self.verification_status = self.VerificationStatus.VERIFIED
        self.verified_at = timezone.now()
        self.verification_feedback = ""
        self.save(
            update_fields=(
                "verification_status",
                "verified_at",
                "verification_feedback",
                "updated_at",
            )
        )


class ProviderVerificationDocument(models.Model):
    class DocumentType(models.TextChoices):
        IDENTITY = "IDENTITY", "Documento de identificação"
        BUSINESS_REGISTRATION = "BUSINESS_REGISTRATION", "Registo comercial"
        PROFESSIONAL_CERTIFICATE = "PROFESSIONAL_CERTIFICATE", "Certificação profissional"
        OTHER = "OTHER", "Outro comprovativo"

    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="verification_documents",
    )
    document_type = models.CharField(max_length=32, choices=DocumentType.choices)
    file = models.FileField(
        upload_to=verification_document_upload_to,
        storage=private_verification_storage,
        validators=(validate_verification_document,),
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("uploaded_at", "pk")
        verbose_name = "documento de verificação"
        verbose_name_plural = "documentos de verificação"

    def __str__(self):
        return f"{self.get_document_type_display()} — {self.provider}"
