from django.conf import settings
from django.db import models

from apps.catalog.models import Service
from apps.providers.models import Provider


class FavoriteProvider(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_providers",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "prestador favorito"
        verbose_name_plural = "prestadores favoritos"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "provider"),
                name="unique_favorite_provider_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.user} — {self.provider}"


class FavoriteService(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_services",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        verbose_name = "serviço favorito"
        verbose_name_plural = "serviços favoritos"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "service"),
                name="unique_favorite_service_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.user} — {self.service}"
