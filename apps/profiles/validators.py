from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError

MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024
MAX_PROFILE_PHOTO_PIXELS = 20_000_000
SUPPORTED_IMAGE_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


def validate_profile_photo(upload: UploadedFile) -> None:
    if upload.size > MAX_PROFILE_PHOTO_SIZE:
        raise ValidationError("A foto deve ter no máximo 5 MB.")

    try:
        with Image.open(upload) as image:
            image_format = image.format
            if image_format not in SUPPORTED_IMAGE_EXTENSIONS:
                raise ValidationError(
                    "A foto deve estar no formato JPEG, PNG ou WebP."
                )
            if image.width * image.height > MAX_PROFILE_PHOTO_PIXELS:
                raise ValidationError(
                    "A imagem excede a resolução máxima permitida."
                )
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValidationError("O ficheiro enviado não é uma imagem válida.") from exc
    finally:
        upload.seek(0)

    upload.name = f"{uuid4().hex}{SUPPORTED_IMAGE_EXTENSIONS[image_format]}"
