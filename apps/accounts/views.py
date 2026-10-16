from rest_framework import generics, status
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.throttling import ScopedRateThrottle

from .serializers import (
    AccountSerializer,
    LogoutSerializer,
    RegistrationResponseSerializer,
    RegistrationSerializer,
)
from .throttles import LoginThrottle, RegistrationThrottle


class RecoveryThrottle(ScopedRateThrottle):
    scope = "auth_recovery"


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
        user = serializador.save()
        if getattr(serializador, "created_new_user", False):
            from .tasks import enviar_verificacao_email

            transaction.on_commit(
                lambda: enviar_verificacao_email.delay(user.pk), robust=True
            )
        return Response(
            {
                "detail": (
                    "Pedido recebido. Se os dados forem válidos, enviaremos "
                    "instruções para confirmar o email."
                )
            },
            status=status.HTTP_202_ACCEPTED,
        )


class TokenBodySerializer(serializers.Serializer):
    token = serializers.CharField()


class EmailVerificationView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    @extend_schema(request=TokenBodySerializer, responses={200: RegistrationResponseSerializer})
    def post(self, request):
        serializer = TokenBodySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = signing.loads(
                serializer.validated_data["token"],
                salt="accounts.email-verification",
                max_age=60 * 60 * 24,
            )
            user = get_user_model().objects.get(pk=payload["user_id"])
        except (
            signing.BadSignature,
            signing.SignatureExpired,
            KeyError,
            TypeError,
            get_user_model().DoesNotExist,
        ):
            raise serializers.ValidationError({"token": "A ligação expirou ou é inválida."})
        if user.email != payload.get("email"):
            raise serializers.ValidationError({"token": "A ligação expirou ou é inválida."})
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=("email_verified", "updated_at"))
        return Response({"detail": "Email confirmado. Já podes iniciar sessão."})


class ResendEmailVerificationView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (RecoveryThrottle,)

    def post(self, request):
        serializer = EmailOnlySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().casefold()
        user = get_user_model().objects.filter(email=email, email_verified=False).first()
        if user:
            from .tasks import enviar_verificacao_email

            transaction.on_commit(
                lambda: enviar_verificacao_email.delay(user.pk), robust=True
            )
        return Response({"detail": "Se a conta precisar de confirmação, enviaremos uma nova ligação."})


class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (RecoveryThrottle,)

    def post(self, request):
        serializer = EmailOnlySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().casefold()
        user = get_user_model().objects.filter(
            email=email, is_active=True, email_verified=True
        ).first()
        if user:
            from .tasks import enviar_recuperacao_password

            transaction.on_commit(
                lambda: enviar_recuperacao_password.delay(user.pk), robust=True
            )
        return Response({"detail": "Se a conta existir, enviaremos instruções para recuperar o acesso."})


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class EmailOnlySerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            with transaction.atomic():
                user = get_user_model().objects.select_for_update().get(
                    pk=user_id, is_active=True
                )
                return self._reset_password(user, serializer)
        except (ValueError, TypeError, UnicodeDecodeError, get_user_model().DoesNotExist):
            raise serializers.ValidationError({"token": "A ligação expirou ou é inválida."})

    def _reset_password(self, user, serializer):
        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            raise serializers.ValidationError({"token": "A ligação expirou ou é inválida."})
        from django.contrib.auth import password_validation
        try:
            password_validation.validate_password(serializer.validated_data["password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=("password", "updated_at"))
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)
        return Response({"detail": "Palavra-passe atualizada. Já podes iniciar sessão."})


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        if not user.email_verified:
            raise AuthenticationFailed(
                "No active account found with the given credentials"
            )
        return super().get_token(user)


class LoginView(TokenObtainPairView):
    serializer_class = VerifiedTokenObtainPairSerializer
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
