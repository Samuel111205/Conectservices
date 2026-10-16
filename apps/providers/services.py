from django.db import IntegrityError, transaction

from .exceptions import ProviderConflict
from .models import Provider, ProviderVerificationAuditEvent


def criar_prestador(*, user, **provider_data):
    try:
        with transaction.atomic():
            return Provider.objects.create(user=user, **provider_data)
    except IntegrityError as exc:
        if Provider.objects.filter(user=user).exists():
            raise ProviderConflict from exc
        raise


@transaction.atomic
def registar_transicao_verificacao(*, provider, actor, previous_status):
    if previous_status == provider.verification_status:
        return None
    return ProviderVerificationAuditEvent.objects.create(
        actor=actor,
        provider=provider,
        provider_name_snapshot=provider.commercial_name,
        previous_status=previous_status or "",
        new_status=provider.verification_status,
        feedback_snapshot=provider.verification_feedback,
    )
