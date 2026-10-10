from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import CatalogAuditEvent


@transaction.atomic
def registar_alteracao_categoria(*, category, actor, action):
    return CatalogAuditEvent.objects.create(
        actor=actor,
        action=action,
        category_id_snapshot=category.pk,
        category_name_snapshot=category.name,
    )


@transaction.atomic
def desativar_categoria(*, category, actor):
    if category.is_active:
        if category.children.filter(is_active=True).exists():
            raise ValidationError(
                {"is_active": "Desative primeiro as subcategorias ativas."}
            )
        category.is_active = False
        category.save(update_fields=("is_active", "updated_at"))
        registar_alteracao_categoria(
            category=category,
            actor=actor,
            action=CatalogAuditEvent.Action.CATEGORY_DEACTIVATED,
        )


@transaction.atomic
def guardar_categoria(*, serializer, actor, creating):
    categoria = serializer.save()
    acao = (
        CatalogAuditEvent.Action.CATEGORY_CREATED
        if creating
        else CatalogAuditEvent.Action.CATEGORY_UPDATED
    )
    registar_alteracao_categoria(category=categoria, actor=actor, action=acao)
    return categoria
