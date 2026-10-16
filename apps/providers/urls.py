from django.urls import path

from .views import (
    CurrentProviderView,
    ProviderCreateView,
    ProviderDiscoveryView,
    ProviderPublicDetailView,
    ProviderVerificationDocumentDeleteView,
    ProviderVerificationDocumentListCreateView,
    SubmitProviderVerificationView,
)

urlpatterns = [
    path("discover/", ProviderDiscoveryView.as_view(), name="provider-discover"),
    path("<int:pk>/", ProviderPublicDetailView.as_view(), name="provider-public-detail"),
    path(
        "me/verification-documents/",
        ProviderVerificationDocumentListCreateView.as_view(),
        name="provider-verification-documents",
    ),
    path(
        "me/verification-documents/<int:pk>/",
        ProviderVerificationDocumentDeleteView.as_view(),
        name="provider-verification-document-delete",
    ),
    path(
        "me/submit-verification/",
        SubmitProviderVerificationView.as_view(),
        name="provider-submit-verification",
    ),
    path("", ProviderCreateView.as_view(), name="provider-create"),
    path("me/", CurrentProviderView.as_view(), name="provider-me"),
]
