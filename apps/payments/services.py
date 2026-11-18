from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.bookings.models import Booking

from .models import Payment, PaymentAuditEvent, RefundAuditEvent, RefundRequest


@transaction.atomic
def criar_registo_pagamento(*, booking_id, actor, method, external_reference=""):
    contratacao = Booking.objects.select_for_update().filter(pk=booking_id).first()
    if contratacao is None:
        raise NotFound({"booking_id": "A contratação indicada não existe."})
    if contratacao.client_id != actor.pk:
        raise PermissionDenied(
            {"booking_id": "Só o cliente da contratação pode registar o pagamento."}
        )
    if contratacao.status == Booking.Status.CANCELLED:
        raise ValidationError(
            {"booking_id": "Não é possível registar pagamento numa contratação cancelada."}
        )
    if Payment.objects.filter(
        booking=contratacao,
        status__in=(Payment.Status.PENDING, Payment.Status.CONFIRMED),
    ).exists():
        raise ValidationError(
            {"booking_id": "A contratação já tem um pagamento pendente ou confirmado."}
        )

    try:
        with transaction.atomic():
            pagamento = Payment.objects.create(
                booking=contratacao,
                amount=contratacao.final_price,
                currency=contratacao.currency,
                method=method,
                external_reference=external_reference,
            )
            PaymentAuditEvent.objects.create(
                payment=pagamento,
                actor=actor,
                previous_status="",
                new_status=pagamento.status,
            )
            return pagamento
    except IntegrityError as exc:
        if Payment.objects.filter(
            booking=contratacao,
            status__in=(Payment.Status.PENDING, Payment.Status.CONFIRMED),
        ).exists():
            raise ValidationError(
                {"booking_id": "A contratação já tem um pagamento pendente ou confirmado."}
            ) from exc
        raise


@transaction.atomic
def avaliar_pagamento(*, payment_id, actor, status):
    payment_reference = Payment.objects.only("booking_id").filter(
        pk=payment_id
    ).first()
    if payment_reference is None:
        raise NotFound("O pagamento indicado não existe.")
    Booking.objects.select_for_update().get(pk=payment_reference.booking_id)
    pagamento = Payment.objects.select_for_update().get(pk=payment_id)

    if not actor.is_staff:
        raise PermissionDenied("Só um administrador pode rever pagamentos.")
    if status not in (Payment.Status.CONFIRMED, Payment.Status.REJECTED):
        raise ValidationError("Estado de revisão inválido.")
    if pagamento.status != Payment.Status.PENDING:
        raise ValidationError("Só é possível rever pagamentos pendentes.")

    previous_status = pagamento.status
    pagamento.status = status
    pagamento.reviewed_by = actor
    pagamento.reviewed_at = timezone.now()
    pagamento.save(update_fields=("status", "reviewed_by", "reviewed_at"))
    PaymentAuditEvent.objects.create(
        payment=pagamento,
        actor=actor,
        previous_status=previous_status,
        new_status=status,
    )
    return pagamento


@transaction.atomic
def criar_pedido_reembolso(*, booking_id, actor, amount, reason):
    contratacao = Booking.objects.select_for_update().select_related(
        "provider__user"
    ).filter(pk=booking_id).first()
    if contratacao is None:
        raise NotFound("A contratação indicada não existe.")
    if contratacao.client_id != actor.pk:
        raise PermissionDenied("Só o cliente que efectuou o pagamento pode pedir reembolso.")

    pagamento = Payment.objects.select_for_update().filter(
        booking=contratacao,
        status=Payment.Status.CONFIRMED,
    ).first()
    if pagamento is None:
        raise ValidationError(
            {"booking_id": "Não existe um pagamento confirmado para esta contratação."}
        )

    if RefundRequest.objects.filter(
        payment=pagamento,
        status__in=(RefundRequest.Status.REQUESTED, RefundRequest.Status.APPROVED),
    ).exists():
        raise ValidationError(
            {"booking_id": "Já existe um pedido de reembolso em análise para esta contratação."}
        )

    montante_reservado = RefundRequest.objects.filter(
        payment=pagamento,
        status__in=(
            RefundRequest.Status.REQUESTED,
            RefundRequest.Status.APPROVED,
            RefundRequest.Status.PAID,
        ),
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    if amount + montante_reservado > pagamento.amount:
        raise ValidationError(
            {"amount": "O valor excede o saldo disponível para reembolso."}
        )

    pedido = RefundRequest.objects.create(
        payment=pagamento,
        requested_by=actor,
        amount=amount,
        reason=reason,
    )
    from apps.messaging.services import criar_notificacao_de_caso

    criar_notificacao_de_caso(
        recipient=contratacao.provider.user,
        actor=actor,
        title="Novo pedido de reembolso",
        body=f"O cliente pediu um reembolso relativo à contratação #{contratacao.pk}.",
        refund_request=pedido,
    )
    RefundAuditEvent.objects.create(
        refund_request=pedido,
        actor=actor,
        previous_status="",
        new_status=pedido.status,
        note="Pedido registado; ainda não constitui uma devolução de fundos.",
    )
    return pedido


@transaction.atomic
def avaliar_pedido_reembolso(*, refund_request_id, actor, status, note=""):
    referencia = RefundRequest.objects.select_related("payment").filter(
        pk=refund_request_id
    ).first()
    if referencia is None:
        raise NotFound("O pedido de reembolso indicado não existe.")
    Booking.objects.select_for_update().get(pk=referencia.payment.booking_id)
    pedido = RefundRequest.objects.select_for_update().select_related(
        "payment__booking__client"
    ).get(pk=refund_request_id)

    if not actor.is_staff:
        raise PermissionDenied("Só a equipa de apoio pode rever pedidos de reembolso.")
    if status not in (RefundRequest.Status.APPROVED, RefundRequest.Status.REJECTED):
        raise ValidationError("Estado de revisão inválido.")
    if pedido.status != RefundRequest.Status.REQUESTED:
        raise ValidationError("Só é possível rever pedidos ainda não analisados.")
    if status == RefundRequest.Status.REJECTED and not note.strip():
        raise ValidationError({"decision_note": "Indica o motivo da rejeição."})

    previous_status = pedido.status
    pedido.status = status
    pedido.reviewed_by = actor
    pedido.reviewed_at = timezone.now()
    pedido.decision_note = note
    pedido.save(
        update_fields=(
            "status",
            "reviewed_by",
            "reviewed_at",
            "decision_note",
            "updated_at",
        )
    )
    RefundAuditEvent.objects.create(
        refund_request=pedido,
        actor=actor,
        previous_status=previous_status,
        new_status=status,
        note=note,
    )
    from apps.messaging.services import criar_notificacao_de_caso

    criar_notificacao_de_caso(
        recipient=pedido.requested_by,
        actor=actor,
        title="Actualização do pedido de reembolso",
        body=f"O pedido de reembolso #{pedido.pk} foi {pedido.get_status_display().lower()}.",
        refund_request=pedido,
    )
    return pedido


@transaction.atomic
def confirmar_reembolso_pago(*, refund_request_id, actor, payout_reference):
    referencia = RefundRequest.objects.select_related("payment").filter(
        pk=refund_request_id
    ).first()
    if referencia is None:
        raise NotFound("O pedido de reembolso indicado não existe.")
    Booking.objects.select_for_update().select_related("provider__user").get(
        pk=referencia.payment.booking_id
    )
    pedido = RefundRequest.objects.select_for_update().select_related(
        "payment__booking__provider__user", "requested_by"
    ).get(pk=refund_request_id)

    if pedido.payment.booking.provider.user_id != actor.pk:
        raise PermissionDenied("Só o prestador que recebeu o pagamento pode confirmar a devolução.")
    if pedido.status != RefundRequest.Status.APPROVED:
        raise ValidationError("Só um reembolso aprovado pode ser confirmado como pago.")
    if not payout_reference.strip():
        raise ValidationError({"payout_reference": "Indica a referência da transferência."})

    previous_status = pedido.status
    pedido.status = RefundRequest.Status.PAID
    pedido.payout_reference = payout_reference.strip()
    pedido.refunded_at = timezone.now()
    pedido.save(
        update_fields=(
            "status",
            "payout_reference",
            "refunded_at",
            "updated_at",
        )
    )
    RefundAuditEvent.objects.create(
        refund_request=pedido,
        actor=actor,
        previous_status=previous_status,
        new_status=pedido.status,
        note="O prestador confirmou a devolução fora da plataforma.",
    )
    from apps.messaging.services import criar_notificacao_de_caso

    criar_notificacao_de_caso(
        recipient=pedido.requested_by,
        actor=actor,
        title="Reembolso confirmado pelo prestador",
        body=f"O prestador confirmou a devolução do pedido #{pedido.pk}.",
        refund_request=pedido,
    )
    return pedido


@transaction.atomic
def cancelar_pedido_reembolso(*, refund_request_id, actor):
    try:
        pedido = RefundRequest.objects.select_for_update().select_related(
            "payment__booking__provider__user"
        ).get(pk=refund_request_id)
    except RefundRequest.DoesNotExist as exc:
        raise NotFound("O pedido de reembolso indicado não existe.") from exc
    if pedido.requested_by_id != actor.pk:
        raise PermissionDenied("Só quem abriu o pedido pode cancelá-lo.")
    if pedido.status != RefundRequest.Status.REQUESTED:
        raise ValidationError("Só é possível cancelar um pedido ainda não analisado.")

    previous_status = pedido.status
    pedido.status = RefundRequest.Status.CANCELLED
    pedido.save(update_fields=("status", "updated_at"))
    RefundAuditEvent.objects.create(
        refund_request=pedido,
        actor=actor,
        previous_status=previous_status,
        new_status=pedido.status,
        note="Pedido cancelado pelo cliente.",
    )
    from apps.messaging.services import criar_notificacao_de_caso

    criar_notificacao_de_caso(
        recipient=pedido.payment.booking.provider.user,
        actor=actor,
        title="Pedido de reembolso cancelado",
        body=f"O cliente cancelou o pedido de reembolso #{pedido.pk}.",
        refund_request=pedido,
    )
    return pedido
