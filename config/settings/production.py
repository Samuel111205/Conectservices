import os

from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production.")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "Set at least one hostname in DJANGO_ALLOWED_HOSTS for production."
    )

if DATABASE_ENGINE != "django.db.backends.postgresql":
    raise ImproperlyConfigured(
        "Production must use PostgreSQL via DATABASE_ENGINE."
    )

if not REDIS_URL:
    raise ImproperlyConfigured("REDIS_URL must be set in production.")

for setting_name in (
    "AWS_STORAGE_BUCKET_NAME",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_REGION_NAME",
):
    if not os.environ.get(setting_name):
        raise ImproperlyConfigured(
            f"{setting_name} must be set for private verification document storage."
        )

STORAGES["verification_documents"] = {
    "BACKEND": "storages.backends.s3.S3Storage",
    "OPTIONS": {
        "bucket_name": os.environ["AWS_STORAGE_BUCKET_NAME"],
        "access_key": os.environ["AWS_ACCESS_KEY_ID"],
        "secret_key": os.environ["AWS_SECRET_ACCESS_KEY"],
        "region_name": os.environ["AWS_S3_REGION_NAME"],
        "endpoint_url": os.environ.get("AWS_S3_ENDPOINT_URL") or None,
        "location": "private-verification",
        "default_acl": None,
        "querystring_auth": True,
        "querystring_expire": 300,
        "file_overwrite": False,
        "object_parameters": {"CacheControl": "private, no-store"},
    },
}

EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend",
)
for setting_name in (
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "DB_HOST",
):
    if not os.environ.get(setting_name):
        raise ImproperlyConfigured(f"{setting_name} must be set in production.")
if EMAIL_NOTIFICATIONS_ENABLED and not os.environ.get("DEFAULT_FROM_EMAIL"):
    raise ImproperlyConfigured(
        "DEFAULT_FROM_EMAIL must be set when email notifications are enabled."
    )
if (
    EMAIL_NOTIFICATIONS_ENABLED
    and EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend"
):
    for setting_name in (
        "EMAIL_HOST",
        "EMAIL_HOST_USER",
        "EMAIL_HOST_PASSWORD",
    ):
        if not os.environ.get(setting_name):
            raise ImproperlyConfigured(
                f"{setting_name} must be set when using SMTP notifications in production."
            )
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ImproperlyConfigured("EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be enabled.")

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.environ.get("DJANGO_HSTS_INCLUDE_SUBDOMAINS", "").lower() == "true"
)
SECURE_HSTS_PRELOAD = os.environ.get("DJANGO_HSTS_PRELOAD", "").lower() == "true"
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
