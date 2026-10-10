from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models

from .validators import validate_profile_photo


def profile_photo_upload_to(instance, filename):
    return f"profiles/{filename}"


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    full_name = models.CharField(max_length=160)
    photo = models.ImageField(
        upload_to=profile_photo_upload_to,
        blank=True,
        validators=(validate_profile_photo,),
    )
    biography = models.TextField(
        blank=True,
        validators=(MaxLengthValidator(2000),),
    )
    birth_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "perfil"
        verbose_name_plural = "perfis"

    def __str__(self):
        return self.full_name
