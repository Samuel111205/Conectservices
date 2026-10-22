from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.providers.models import Provider

from .models import Product, ProductOrder, ProductOrderItem


def _notificar_encomenda(*, encomenda, recipient, actor, title, body):
    from apps.messaging.services import criar_notificacao_encomenda

    return criar_notificacao_encomenda(
        encomenda=encomenda,
        recipient=recipient,
        actor=actor,
        title=title,
        body=body,
    )


def _restaurar_stock(encomenda):
    for item in encomenda.items.all():
        Product.objects.filter(pk=item.product_id).update(
            stock_quantity=F("stock_quantity") + item.quantity,
        )


def _obter_encomenda_com_lock(order_id):
    try:
        return ProductOrder.objects.select_for_update().select_related(
            "buyer",
            "provider__user",
        ).get(pk=order_id)
    except ProductOrder.DoesNotExist as exc:
        raise ValidationError("A encomenda indicada não existe.") from exc


def _validar_empresa(encomenda, actor):
    if encomenda.provider.user_id != actor.pk:
        raise PermissionDenied("Só a empresa responsável pode gerir esta encomenda.")


@transaction.atomic
def criar_encomenda(*, buyer, items, delivery_notes=""):
    if not items:
        raise ValidationError({"items": "Adiciona pelo menos um produto à encomenda."})

    product_ids = [item["product_id"] for item in items]
    if len(set(product_ids)) != len(product_ids):
        raise ValidationError({"items": "Cada produto só pode aparecer uma vez na encomenda."})

    products = list(
        Product.objects.select_for_update()
        .select_related("provider", "provider__user", "category")
        .filter(pk__in=product_ids)
        .order_by("pk")
    )
    if len(products) != len(product_ids):
        raise ValidationError({"items": "Um ou mais produtos já não estão disponíveis."})

    provider_ids = {product.provider_id for product in products}
    if len(provider_ids) != 1:
        raise ValidationError(
            {"items": "Cada encomenda deve incluir produtos da mesma empresa."}
        )

    provider = products[0].provider
    if provider.user_id == buyer.pk:
        raise ValidationError("Não podes encomendar produtos da tua própria empresa.")
    if (
        not provider.user.is_active
        or provider.verification_status != Provider.VerificationStatus.VERIFIED
    ):
        raise ValidationError("Esta empresa não está disponível para receber encomendas.")

    products_by_id = {product.pk: product for product in products}
    total_amount = Decimal("0.00")
    for item in items:
        product = products_by_id[item["product_id"]]
        quantity = item["quantity"]
        if (
            not product.is_active
            or not product.category.is_active
            or product.stock_quantity < quantity
        ):
            raise ValidationError(
                {"items": f"Não há stock suficiente de {product.name}."}
            )
        total_amount += product.price * quantity

    encomenda = ProductOrder.objects.create(
        buyer=buyer,
        provider=provider,
        total_amount=total_amount,
        currency="AOA",
        delivery_notes=delivery_notes,
    )
    for item in items:
        product = products_by_id[item["product_id"]]
        quantity = item["quantity"]
        ProductOrderItem.objects.create(
            order=encomenda,
            product=product,
            product_name=product.name,
            unit_price=product.price,
            quantity=quantity,
        )
        product.stock_quantity -= quantity
        product.save(update_fields=("stock_quantity", "updated_at"))
    _notificar_encomenda(
        encomenda=encomenda,
        recipient=provider.user,
        actor=buyer,
        title="Nova encomenda recebida",
        body=(
            f"A encomenda #{encomenda.pk} foi criada. Revê os artigos e aceita "
            "ou recusa o pedido na área de encomendas."
        ),
    )
    return encomenda


@transaction.atomic
def aceitar_encomenda(*, order_id, actor):
    encomenda = _obter_encomenda_com_lock(order_id)
    _validar_empresa(encomenda, actor)
    if encomenda.status != ProductOrder.Status.PENDING:
        raise ValidationError("Só podes aceitar uma encomenda pendente.")
    encomenda.status = ProductOrder.Status.ACCEPTED
    encomenda.save(update_fields=("status", "updated_at"))
    _notificar_encomenda(
        encomenda=encomenda,
        recipient=encomenda.buyer,
        actor=actor,
        title="Encomenda aceite",
        body=f"A empresa aceitou a encomenda #{encomenda.pk}.",
    )
    return encomenda


@transaction.atomic
def recusar_encomenda(*, order_id, actor):
    encomenda = _obter_encomenda_com_lock(order_id)
    _validar_empresa(encomenda, actor)
    if encomenda.status != ProductOrder.Status.PENDING:
        raise ValidationError("Só podes recusar uma encomenda pendente.")
    encomenda.status = ProductOrder.Status.REJECTED
    encomenda.save(update_fields=("status", "updated_at"))
    _restaurar_stock(encomenda)
    _notificar_encomenda(
        encomenda=encomenda,
        recipient=encomenda.buyer,
        actor=actor,
        title="Encomenda recusada",
        body=f"A empresa recusou a encomenda #{encomenda.pk}.",
    )
    return encomenda


@transaction.atomic
def concluir_encomenda(*, order_id, actor):
    encomenda = _obter_encomenda_com_lock(order_id)
    _validar_empresa(encomenda, actor)
    if encomenda.status != ProductOrder.Status.ACCEPTED:
        raise ValidationError("Só podes concluir uma encomenda que já aceitaste.")
    encomenda.status = ProductOrder.Status.COMPLETED
    encomenda.save(update_fields=("status", "updated_at"))
    _notificar_encomenda(
        encomenda=encomenda,
        recipient=encomenda.buyer,
        actor=actor,
        title="Encomenda concluída",
        body=(
            f"A encomenda #{encomenda.pk} foi concluída. Já podes avaliar "
            "a tua experiência."
        ),
    )
    return encomenda


@transaction.atomic
def cancelar_encomenda(*, order_id, actor):
    encomenda = _obter_encomenda_com_lock(order_id)
    e_cliente = encomenda.buyer_id == actor.pk
    e_empresa = encomenda.provider.user_id == actor.pk
    if not e_cliente and not e_empresa:
        raise PermissionDenied("Não tens acesso a esta encomenda.")
    if encomenda.status != ProductOrder.Status.PENDING and not (
        e_empresa and encomenda.status == ProductOrder.Status.ACCEPTED
    ):
        raise ValidationError("Esta encomenda já não pode ser cancelada.")
    encomenda.status = ProductOrder.Status.CANCELLED
    encomenda.save(update_fields=("status", "updated_at"))
    _restaurar_stock(encomenda)
    _notificar_encomenda(
        encomenda=encomenda,
        recipient=encomenda.provider.user if e_cliente else encomenda.buyer,
        actor=actor,
        title="Encomenda cancelada",
        body=f"A encomenda #{encomenda.pk} foi cancelada.",
    )
    return encomenda
