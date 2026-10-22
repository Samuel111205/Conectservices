from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied

from apps.providers.models import Provider

from .exceptions import BusinessProfileConflict
from .models import BusinessProfile


@transaction.atomic
def criar_perfil_empresarial(*, user, provider_data, business_data):
    if not user.is_active:
        raise PermissionDenied(
            "Uma conta inactiva não pode criar um perfil empresarial."
        )

    try:
        with transaction.atomic():
            provider = Provider.objects.filter(user=user).first()
            if provider is None:
                provider = Provider.objects.create(user=user, **provider_data)
            else:
                if BusinessProfile.objects.filter(provider=provider).exists():
                    raise BusinessProfileConflict
                for field, value in provider_data.items():
                    setattr(provider, field, value)
                provider.save(update_fields=(*provider_data.keys(), "updated_at"))

            return BusinessProfile.objects.create(
                provider=provider,
                **business_data,
            )
    except IntegrityError as exc:
        if BusinessProfile.objects.filter(provider__user=user).exists():
            raise BusinessProfileConflict from exc
        raise


@transaction.atomic
def atualizar_perfil_empresarial(*, profile, provider_data, business_data):
    provider = profile.provider
    if provider_data:
        for field, value in provider_data.items():
            setattr(provider, field, value)
        provider.save(update_fields=(*provider_data.keys(), "updated_at"))

    previous_logo = profile.logo if "logo" in business_data else None
    for field, value in business_data.items():
        setattr(profile, field, value)
    profile.save(update_fields=(*business_data.keys(), "updated_at"))

    if (
        previous_logo
        and previous_logo.name
        and previous_logo.name != profile.logo.name
    ):
        transaction.on_commit(
            lambda stored_logo=previous_logo: stored_logo.delete(save=False)
        )

    return profile
