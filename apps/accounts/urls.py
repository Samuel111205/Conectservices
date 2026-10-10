from django.urls import path

from .views import (
    CurrentAccountView,
    LoginView,
    LogoutView,
    RefreshView,
    RegistrationView,
)

urlpatterns = [
    path("register/", RegistrationView.as_view(), name="auth-register"),
    path("token/", LoginView.as_view(), name="auth-token"),
    path("token/refresh/", RefreshView.as_view(), name="auth-token-refresh"),
    path("me/", CurrentAccountView.as_view(), name="auth-me"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
]
