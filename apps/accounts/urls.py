from django.urls import path

from .views import (
    CurrentAccountView,
    EmailVerificationView,
    LoginView,
    LogoutView,
    RefreshView,
    RegistrationView,
    ResendEmailVerificationView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)

urlpatterns = [
    path("register/", RegistrationView.as_view(), name="auth-register"),
    path("verify-email/", EmailVerificationView.as_view(), name="auth-verify-email"),
    path("verify-email/resend/", ResendEmailVerificationView.as_view(), name="auth-verify-email-resend"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("token/", LoginView.as_view(), name="auth-token"),
    path("token/refresh/", RefreshView.as_view(), name="auth-token-refresh"),
    path("me/", CurrentAccountView.as_view(), name="auth-me"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
]
