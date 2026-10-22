import os

from .base import *

DEBUG = True
WEB_APP_URL = os.environ.get("WEB_APP_URL") or "http://localhost:3000"
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
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

# When Redis is not configured, run background tasks locally instead of
# blocking requests while Celery retries an unavailable broker connection.
CELERY_TASK_ALWAYS_EAGER = os.environ.get(
    "CELERY_TASK_ALWAYS_EAGER",
    "false" if REDIS_URL else "true",
).lower() == "true"
