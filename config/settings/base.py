import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "apps.accounts.apps.AccountsConfig",
    "apps.profiles.apps.ProfilesConfig",
    "apps.providers.apps.ProvidersConfig",
    "apps.catalog.apps.CatalogConfig",
    "apps.locations.apps.LocationsConfig",
    "apps.orders.apps.OrdersConfig",
    "apps.proposals.apps.ProposalsConfig",
    "apps.bookings.apps.BookingsConfig",
    "apps.reviews.apps.ReviewsConfig",
    "apps.payments.apps.PaymentsConfig",
    "apps.dashboard.apps.DashboardConfig",
    "apps.favorites.apps.FavoritesConfig",
    "apps.messaging.apps.MessagingConfig",
    "apps.availability.apps.AvailabilityConfig",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "rest_framework_simplejwt.token_blacklist",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASE_ENGINE = os.environ.get(
    "DATABASE_ENGINE",
    "django.db.backends.sqlite3",
)
REDIS_URL = os.environ.get("REDIS_URL")

if DATABASE_ENGINE == "django.db.backends.postgresql":
    DATABASES = {
        "default": {
            "ENGINE": DATABASE_ENGINE,
            "NAME": os.environ.get("DB_NAME", "conect_services"),
            "USER": os.environ.get("DB_USER", "conect_services"),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "localhost"),
            "PORT": os.environ.get("DB_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": DATABASE_ENGINE,
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

CACHES = {
    "default": {
        "BACKEND": (
            "django_redis.cache.RedisCache"
            if REDIS_URL
            else "django.core.cache.backends.locmem.LocMemCache"
        ),
        "LOCATION": REDIS_URL or "conect-services-local",
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"}
        if REDIS_URL
        else {},
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "pt-ao"
TIME_ZONE = "Africa/Luanda"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
    "verification_documents": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {
            "location": BASE_DIR / "private_uploads",
        },
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "false").lower() == "true"
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "")
EMAIL_NOTIFICATIONS_ENABLED = (
    os.environ.get("EMAIL_NOTIFICATIONS_ENABLED", "true").lower() == "true"
)
WEB_APP_URL = os.environ.get("WEB_APP_URL", "").rstrip("/")

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "5/minute",
        "auth_register": "5/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
}

AUTH_USER_MODEL = "accounts.User"

SPECTACULAR_SETTINGS = {
    "TITLE": "Conect Services API",
    "DESCRIPTION": "API da plataforma Conect Services.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "ENUM_NAME_OVERRIDES": {
        "OrderStatusEnum": [
            ("OPEN", "Aberto"),
            ("NEGOTIATING", "Em negociação"),
            ("AWARDED", "Contratado"),
            ("COMPLETED", "Concluído"),
            ("CANCELLED", "Cancelado"),
        ],
        "ProposalStatusEnum": [
            ("PENDING", "Pendente"),
            ("ACCEPTED", "Aceite"),
            ("REJECTED", "Rejeitada"),
            ("CANCELLED", "Cancelada"),
        ],
        "BookingStatusEnum": [
            ("SCHEDULED", "Agendado"),
            ("CONFIRMED", "Confirmado"),
            ("IN_PROGRESS", "Em execução"),
            ("COMPLETED", "Concluído"),
            ("CANCELLED", "Cancelado"),
        ],
    },
}
