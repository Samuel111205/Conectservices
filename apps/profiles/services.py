from django.db import IntegrityError, transaction

from .exceptions import ProfileConflict
from .models import Profile


def criar_perfil(*, user, **profile_data):
    try:
        with transaction.atomic():
            return Profile.objects.create(user=user, **profile_data)
    except IntegrityError as exc:
        if Profile.objects.filter(user=user).exists():
            raise ProfileConflict from exc
        raise
