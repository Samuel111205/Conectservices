from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError

MAX_VERIFICATION_DOCUMENT_SIZE = 10 * 1024 * 1024
MAX_VERIFICATION_IMAGE_PIXELS = 30_000_000


def validate_verification_document(upload: UploadedFile) -> None:
    if upload.size > MAX_VERIFICATION_DOCUMENT_SIZE:
        raise ValidationError("O documento deve ter no máximo 10 MB.")

    upload.seek(0)
    signature = upload.read(8)
    upload.seek(0)
    if signature.startswith(b"%PDF-"):
        extension = ".pdf"
    else:
        try:
            with Image.open(upload) as image:
                image_format = image.format
                if image_format not in {"JPEG", "PNG"}:
                    raise ValidationError(
                        "O documento deve estar em PDF, JPEG ou PNG."
                    )
                if image.width * image.height > MAX_VERIFICATION_IMAGE_PIXELS:
                    raise ValidationError(
                        "A imagem excede a resolução máxima permitida."
                    )
                image.verify()
                extension = ".jpg" if image_format == "JPEG" else ".png"
        except ValidationError:
            raise
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise ValidationError(
                "O ficheiro enviado não é um PDF, JPEG ou PNG válido."
            ) from exc
        finally:
            upload.seek(0)

    upload.name = f"{uuid4().hex}{extension}"
