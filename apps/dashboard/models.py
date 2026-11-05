from django.db import models


class ListingView(models.Model):
    class ListingType(models.TextChoices):
        PROVIDER = "PROVIDER", "Perfil de prestador"
        SERVICE = "SERVICE", "Serviço"
        PRODUCT = "PRODUCT", "Produto"

    listing_type = models.CharField(max_length=8, choices=ListingType.choices)
    listing_id = models.PositiveBigIntegerField()
    provider = models.ForeignKey(
        "providers.Provider",
        on_delete=models.CASCADE,
        related_name="listing_views",
    )
    session_hash = models.CharField(max_length=64)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-viewed_at", "-pk")
        verbose_name = "visualização de publicação"
        verbose_name_plural = "visualizações de publicações"
        constraints = [
            models.UniqueConstraint(
                fields=("listing_type", "listing_id", "session_hash"),
                name="unique_listing_view_per_session",
            ),
        ]
        indexes = [
            models.Index(
                fields=("provider", "-viewed_at"),
                name="listing_view_provider_date_idx",
            ),
            models.Index(
                fields=("listing_type", "listing_id", "-viewed_at"),
                name="listing_view_target_date_idx",
            ),
        ]
