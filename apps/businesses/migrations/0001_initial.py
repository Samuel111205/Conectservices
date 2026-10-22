import django.db.models.deletion
import apps.businesses.models
import apps.profiles.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("providers", "0004_providerverificationauditevent"),
    ]

    operations = [
        migrations.CreateModel(
            name="BusinessProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("registered_name", models.CharField(blank=True, max_length=160)),
                (
                    "logo",
                    models.ImageField(
                        blank=True,
                        upload_to=apps.businesses.models.business_logo_upload_to,
                        validators=[apps.profiles.validators.validate_profile_photo],
                    ),
                ),
                ("website", models.URLField(blank=True)),
                ("address", models.CharField(blank=True, max_length=250)),
                ("opening_hours", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="business_profile",
                        to="providers.provider",
                    ),
                ),
            ],
            options={
                "verbose_name": "perfil empresarial",
                "verbose_name_plural": "perfis empresariais",
                "ordering": ("provider__commercial_name", "pk"),
            },
        ),
    ]
