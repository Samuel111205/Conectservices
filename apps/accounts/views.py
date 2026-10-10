from rest_framework import generics, status
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    AccountSerializer,
    LogoutSerializer,
    RegistrationResponseSerializer,
    RegistrationSerializer,
)
from .throttles import LoginThrottle, RegistrationThrottle


class RegistrationView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (RegistrationThrottle,)
    throttle_scope = "auth_register"

    @extend_schema(
        request=RegistrationSerializer,
        responses={status.HTTP_202_ACCEPTED: RegistrationResponseSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializador = self.get_serializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        serializador.save()
        return Response(
            {
                "detail": (
                    "Pedido de registo recebido. Se os dados forem válidos, "
                    "poderá iniciar sessão."
                )
            },
            status=status.HTTP_202_ACCEPTED,
        )


class LoginView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (LoginThrottle,)
    throttle_scope = "auth_login"


class RefreshView(TokenRefreshView):
    permission_classes = (AllowAny,)
    authentication_classes = ()


class CurrentAccountView(generics.RetrieveUpdateAPIView):
    serializer_class = AccountSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=LogoutSerializer, responses={204: None})
    def post(self, request):
        serializador = LogoutSerializer(
            data=request.data,
            context={"request": request},
        )
        serializador.is_valid(raise_exception=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
