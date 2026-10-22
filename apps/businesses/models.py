from django.db import models

from apps.profiles.validators import validate_profile_photo
from apps.providers.models import Provider


def business_logo_upload_to(instance, filename):
    return f"businesses/{instance.provider_id}/logos/{filename}"


class BusinessProfile(models.Model):
    provider = models.OneToOneField(
        Provider,
        on_delete=models.PROTECT,
        related_name="business_profile",
    )
    registered_name = models.CharField(max_length=160, blank=True)
    logo = models.ImageField(
        upload_to=business_logo_upload_to,
        blank=True,
        validators=(validate_profile_photo,),
    )
    website = models.URLField(blank=True)
    address = models.CharField(max_length=250, blank=True)
    opening_hours = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("provider__commercial_name", "pk")
        verbose_name = "perfil empresarial"
        verbose_name_plural = "perfis empresariais"

    def __str__(self):
        return self.provider.commercial_name
