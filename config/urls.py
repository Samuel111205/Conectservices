"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/providers/", include("apps.providers.urls")),
    path("api/v1/profiles/", include("apps.profiles.urls")),
    path("api/v1/favorites/", include("apps.favorites.urls")),
    path("api/v1/", include("apps.messaging.urls")),
    path("api/v1/availability/", include("apps.availability.urls")),
    path("api/v1/categories/", include("apps.catalog.category_urls")),
    path("api/v1/services/", include("apps.catalog.service_urls")),
    path("api/v1/", include("apps.locations.urls")),
    path("api/v1/orders/", include("apps.orders.urls")),
    path("api/v1/proposals/", include("apps.proposals.urls")),
    path("api/v1/bookings/", include("apps.bookings.urls")),
    path("api/v1/reviews/", include("apps.reviews.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/dashboard/", include("apps.dashboard.urls")),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
]
