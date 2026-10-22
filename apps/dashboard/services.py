from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.catalog.models import Service
from apps.orders.models import ServiceOrder
from apps.payments.models import Payment
from apps.proposals.models import Proposal
from apps.providers.models import Provider
from apps.reviews.models import Review


def _contagens_estados(queryset, choices, *, field="status"):
    counts = queryset.values(field).annotate(count=Count("pk"))
    result = {valor: 0 for valor, _label in choices}
    result.update({row[field]: row["count"] for row in counts})
    return result


def _valor_monetario(value):
    return str((value or Decimal("0.00")).quantize(Decimal("0.01")))


def construir_painel(*, user):
    orders = ServiceOrder.objects.filter(client=user)
    bookings = Booking.objects.filter(client=user)
    payments = Payment.objects.filter(booking__client=user)
    proposals_received = Proposal.objects.filter(order__client=user)

    dashboard = {
        "client": {
            "orders_by_status": _contagens_estados(orders, ServiceOrder.Status.choices),
            "proposals_received_by_status": _contagens_estados(
                proposals_received,
                Proposal.Status.choices,
            ),
            "bookings_by_status": _contagens_estados(bookings, Booking.Status.choices),
            "payments_by_status": _contagens_estados(payments, Payment.Status.choices),
        },
        "provider": None,
        "platform": None,
    }

    prestador = Provider.objects.filter(user=user).first()
    if prestador is not None:
        provider_bookings = Booking.objects.filter(provider=prestador)
        services = Service.objects.filter(provider=prestador)
        service_counts = {
            row["is_active"]: row["count"]
            for row in services.values("is_active").annotate(count=Count("pk"))
        }
        completed_value = provider_bookings.filter(
            status=Booking.Status.COMPLETED,
        ).aggregate(total=Sum("final_price"))["total"]
        confirmed_payments = Payment.objects.filter(
            booking__provider=prestador,
            status=Payment.Status.CONFIRMED,
        ).aggregate(total=Sum("amount"))["total"]
        review_summary = Review.objects.filter(
            Q(booking__provider=prestador)
            | Q(product_order__provider=prestador),
        ).aggregate(average=Avg("rating"), count=Count("pk"))

        dashboard["provider"] = {
            "services": {
                "active": service_counts.get(True, 0),
                "inactive": service_counts.get(False, 0),
            },
            "proposals_by_status": _contagens_estados(
                Proposal.objects.filter(provider=prestador),
                Proposal.Status.choices,
            ),
            "bookings_by_status": _contagens_estados(
                provider_bookings,
                Booking.Status.choices,
            ),
            "reviews": {
                "average_rating": (
                    _valor_monetario(Decimal(str(review_summary["average"])))
                    if review_summary["average"] is not None
                    else None
                ),
                "count": review_summary["count"],
            },
            "completed_booking_value": _valor_monetario(completed_value),
            "confirmed_payments_total": _valor_monetario(confirmed_payments),
            "currency": "AOA",
        }

    if user.is_staff:
        providers_by_status = _contagens_estados(
            Provider.objects.all(),
            Provider.VerificationStatus.choices,
            field="verification_status",
        )
        dashboard["platform"] = {
            "users_total": User.objects.count(),
            "providers_by_verification_status": providers_by_status,
            "orders_by_status": _contagens_estados(
                ServiceOrder.objects.all(),
                ServiceOrder.Status.choices,
            ),
            "bookings_by_status": _contagens_estados(
                Booking.objects.all(),
                Booking.Status.choices,
            ),
            "payments_by_status": _contagens_estados(
                Payment.objects.all(),
                Payment.Status.choices,
            ),
        }

    return dashboard
