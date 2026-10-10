from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from .services import construir_painel


class DashboardView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(construir_painel(user=request.user))
