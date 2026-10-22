from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import BusinessProfile
from .serializers import BusinessProfileSerializer


class BusinessProfileCreateView(generics.CreateAPIView):
    serializer_class = BusinessProfileSerializer
    permission_classes = (IsAuthenticated,)


class CurrentBusinessProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = BusinessProfileSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "patch", "head", "options")

    def get_object(self):
        return get_object_or_404(
            BusinessProfile.objects.select_related("provider"),
            provider__user=self.request.user,
        )
