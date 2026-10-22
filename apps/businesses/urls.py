from django.urls import path

from .views import BusinessProfileCreateView, CurrentBusinessProfileView

urlpatterns = [
    path("", BusinessProfileCreateView.as_view(), name="business-profile-create"),
    path("me/", CurrentBusinessProfileView.as_view(), name="business-profile-me"),
]
