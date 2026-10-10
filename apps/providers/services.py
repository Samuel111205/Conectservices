from django.db import IntegrityError, transaction

from .exceptions import ProviderConflict
from .models import Provider


def criar_prestador(*, user, **provider_data):
    try:
        with transaction.atomic():
            return Provider.objects.create(user=user, **provider_data)
    except IntegrityError as exc:
        if Provider.objects.filter(user=user).exists():
            raise ProviderConflict from exc
        raise
