from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import LocationAuditEvent


@transaction.atomic
def registar_alteracao_localizacao(*, entity, entity_type, actor, action):
    return LocationAuditEvent.objects.create(
        actor=actor,
        entity_type=entity_type,
        entity_id_snapshot=entity.pk,
        entity_name_snapshot=entity.name,
        action=action,
    )


@transaction.atomic
def desativar_provincia(*, province, actor):
    if province.municipalities.filter(is_active=True).exists():
        raise ValidationError(
            {"is_active": "Desative primeiro os municípios ativos."}
        )
    if province.is_active:
        province.is_active = False
        province.save(update_fields=("is_active", "updated_at"))
        registar_alteracao_localizacao(
            entity=province,
            entity_type=LocationAuditEvent.EntityType.PROVINCE,
            actor=actor,
            action=LocationAuditEvent.Action.DEACTIVATED,
        )


@transaction.atomic
def desativar_municipio(*, municipality, actor):
    if municipality.is_active:
        municipality.is_active = False
        municipality.save(update_fields=("is_active", "updated_at"))
        registar_alteracao_localizacao(
            entity=municipality,
            entity_type=LocationAuditEvent.EntityType.MUNICIPALITY,
            actor=actor,
            action=LocationAuditEvent.Action.DEACTIVATED,
        )


@transaction.atomic
def guardar_localizacao(*, serializer, actor, creating, entity_type):
    entity = serializer.save()
    registar_alteracao_localizacao(
        entity=entity,
        entity_type=entity_type,
        actor=actor,
        action=(
            LocationAuditEvent.Action.CREATED
            if creating
            else LocationAuditEvent.Action.UPDATED
        ),
    )
    return entity
