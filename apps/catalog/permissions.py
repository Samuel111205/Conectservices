from rest_framework.permissions import BasePermission, IsAdminUser


class PublicReadAdminWrite(BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return IsAdminUser().has_permission(request, view)
