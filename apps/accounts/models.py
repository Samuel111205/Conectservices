from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("O endereço de e-mail é obrigatório.")

        email = email.strip().casefold()
        telefone = extra_fields.get("phone")
        if telefone is not None:
            extra_fields["phone"] = telefone.strip() or None

        utilizador = self.model(email=email, **extra_fields)
        utilizador.set_password(password)
        utilizador.save(using=self._db)
        return utilizador

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Um superutilizador tem de possuir is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(
                "Um superutilizador tem de possuir is_superuser=True."
            )

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ("date_joined",)
        verbose_name = "utilizador"
        verbose_name_plural = "utilizadores"

    def __str__(self):
        return self.email
