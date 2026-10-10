from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated

from .models import Profile
from .serializers import ProfileSerializer


class ProfileCreateView(generics.CreateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = (IsAuthenticated,)


class CurrentProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "patch", "head", "options")

    @extend_schema(responses=ProfileSerializer)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        return get_object_or_404(Profile, user=self.request.user)
