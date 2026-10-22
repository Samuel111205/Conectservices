import apps.commerce.models
import apps.profiles.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("commerce", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="image",
            field=models.ImageField(
                blank=True,
                upload_to=apps.commerce.models.product_image_upload_to,
                validators=[apps.profiles.validators.validate_profile_photo],
            ),
        ),
    ]
