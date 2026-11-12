import os

from .base import *

DEBUG = True
WEB_APP_URL = os.environ.get("WEB_APP_URL") or "http://localhost:5173"
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "local-development-only-not-for-production",
)
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1",
    ).split(",")
    if host.strip()
]
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CSRF_TRUSTED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# When Redis is not configured, run background tasks locally instead of
# blocking requests while Celery retries an unavailable broker connection.
CELERY_TASK_ALWAYS_EAGER = os.environ.get(
    "CELERY_TASK_ALWAYS_EAGER",
    "false" if REDIS_URL else "true",
).lower() == "true"
