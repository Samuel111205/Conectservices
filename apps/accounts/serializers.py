from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class RegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone = serializers.CharField(
        max_length=32,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        return value.strip().casefold()

    def validate_phone(self, value):
        return value.strip() or None

    def validate(self, atributos):
        candidate = User(email=atributos["email"])
        try:
            password_validation.validate_password(atributos["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"password": list(exc.messages)}
            ) from exc
        return atributos

    def create(self, dados_validados):
        self.created_new_user = False
        try:
            with transaction.atomic():
                utilizador = User.objects.create_user(
                    **dados_validados,
                    email_verified=False,
                )
                self.created_new_user = True
                return utilizador
        except IntegrityError:
            email_exists = User.objects.filter(
                email=dados_validados["email"]
            ).exists()
            telefone = dados_validados.get("phone")
            if email_exists:
                return User.objects.get(email=dados_validados["email"])
            if telefone and User.objects.filter(phone=telefone).exists():
                return User.objects.get(phone=telefone)
            raise


class RegistrationResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()


class AccountSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "phone")
        read_only_fields = ("id", "email")


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(write_only=True)

    def validate_refresh(self, value):
        try:
            token = RefreshToken(value)
        except TokenError as exc:
            raise serializers.ValidationError(
                "O refresh token é inválido ou expirou."
            ) from exc

        if str(token.get("user_id")) != str(self.context["request"].user.pk):
            raise serializers.ValidationError(
                "O refresh token não pertence ao utilizador autenticado."
            )

        token.blacklist()
        return value
