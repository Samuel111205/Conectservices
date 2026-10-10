from django.urls import path

from .views import CurrentProfileView, ProfileCreateView

urlpatterns = [
    path("", ProfileCreateView.as_view(), name="profile-create"),
    path("me/", CurrentProfileView.as_view(), name="profile-me"),
]
