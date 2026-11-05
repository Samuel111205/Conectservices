from decimal import Decimal
from datetime import datetime, time, timedelta
from hashlib import sha256

import pandas as pd
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone

from apps.accounts.models import User
from apps.bookings.models import Booking
from apps.businesses.models import BusinessProfile
from apps.catalog.models import Category, Service
from apps.commerce.models import Product, ProductOrder
from apps.messaging.models import Conversation
from apps.orders.models import ServiceOrder
from apps.payments.models import Payment
from apps.proposals.models import Proposal
from apps.providers.models import Provider, ProviderVerificationAuditEvent
from apps.reviews.models import Review

from .models import ListingView


def _contagens_estados(queryset, choices, *, field="status"):
    counts = queryset.values(field).annotate(count=Count("pk"))
    result = {valor: 0 for valor, _label in choices}
    result.update({row[field]: row["count"] for row in counts})
    return result


def _valor_monetario(value):
    return str((value or Decimal("0.00")).quantize(Decimal("0.01")))


def _inicio_periodo(*, agora, dias):
    inicio = timezone.localdate(agora) - timedelta(days=dias - 1)
    inicio_data_hora = timezone.make_aware(
        datetime.combine(inicio, time.min),
        timezone.get_current_timezone(),
    )
    return inicio, inicio_data_hora


def _contagens_diarias(queryset, *, campo_data, inicio_data_hora):
    return {
        linha["dia"].isoformat(): linha["total"]
        for linha in queryset.filter(**{f"{campo_data}__gte": inicio_data_hora})
        .annotate(dia=TruncDate(campo_data))
        .values("dia")
        .annotate(total=Count("pk"))
        .order_by("dia")
    }


def _criar_serie_diaria(*, inicio, dias, valores):
    indice = pd.date_range(start=inicio, periods=dias, freq="D")
    serie = pd.DataFrame(index=indice)

    for metrica, contagens in valores.items():
        valores_diarios = pd.Series(contagens, dtype="int64")
        valores_diarios.index = pd.to_datetime(valores_diarios.index)
        serie[metrica] = valores_diarios.reindex(indice, fill_value=0).astype("int64")

    return [
        {
            "date": data.strftime("%Y-%m-%d"),
            **{metrica: int(valor) for metrica, valor in linha.items()},
        }
        for data, linha in serie.iterrows()
    ]


def _publicacoes_ativas(provider=None):
    servicos = Service.objects.filter(
        is_active=True,
        provider__verification_status=Provider.VerificationStatus.VERIFIED,
        provider__user__is_active=True,
        category__is_active=True,
    )
    produtos = Product.objects.filter(
        is_active=True,
        stock_quantity__gt=0,
        provider__verification_status=Provider.VerificationStatus.VERIFIED,
        provider__user__is_active=True,
        category__is_active=True,
    )
    if provider is not None:
        servicos = servicos.filter(provider=provider)
        produtos = produtos.filter(provider=provider)
    return servicos, produtos


def registar_visualizacao(*, listing_type, listing_id, session_key, viewer=None):
    from rest_framework.exceptions import NotFound

    tipo = listing_type
    if tipo == ListingView.ListingType.PROVIDER:
        provider = Provider.objects.filter(
            pk=listing_id,
            verification_status=Provider.VerificationStatus.VERIFIED,
            user__is_active=True,
        ).first()
    elif tipo == ListingView.ListingType.SERVICE:
        provider = Provider.objects.filter(
            services__pk=listing_id,
            services__is_active=True,
            services__category__is_active=True,
            verification_status=Provider.VerificationStatus.VERIFIED,
            user__is_active=True,
        ).first()
    else:
        provider = Provider.objects.filter(
            products__pk=listing_id,
            products__is_active=True,
            products__stock_quantity__gt=0,
            products__category__is_active=True,
            verification_status=Provider.VerificationStatus.VERIFIED,
            user__is_active=True,
        ).first()
    if provider is None:
        raise NotFound("Esta publicação não está disponível.")
    if viewer is not None and viewer.is_authenticated and provider.user_id == viewer.pk:
        return None, False

    session_hash = sha256(str(session_key).encode("utf-8")).hexdigest()
    return ListingView.objects.get_or_create(
        listing_type=tipo,
        listing_id=listing_id,
        session_hash=session_hash,
        defaults={"provider": provider},
    )


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


def construir_painel_administrativo(*, periodo=30):
    """Return platform-wide data for staff users; never populate demo values."""
    agora = timezone.now()
    inicio_periodo = agora - timedelta(days=365)
    inicio_serie, inicio_serie_data_hora = _inicio_periodo(agora=agora, dias=periodo)
    servicos_publicados, produtos_publicados = _publicacoes_ativas()

    utilizadores_por_mes = {
        linha["mes"].strftime("%Y-%m"): linha["total"]
        for linha in User.objects.filter(date_joined__gte=inicio_periodo)
        .annotate(mes=TruncMonth("date_joined"))
        .values("mes")
        .annotate(total=Count("pk"))
        .order_by("mes")
    }
    meses = []
    mes_atual = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for deslocamento in range(11, -1, -1):
        ano = mes_atual.year
        mes = mes_atual.month - deslocamento
        while mes <= 0:
            mes += 12
            ano -= 1
        chave = f"{ano:04d}-{mes:02d}"
        meses.append({"month": chave, "users": utilizadores_por_mes.get(chave, 0)})

    distribuicao_categorias = list(
        Category.objects.filter(is_active=True)
        .annotate(
            total=Count(
                "services",
                filter=Q(
                    services__is_active=True,
                    services__provider__verification_status=Provider.VerificationStatus.VERIFIED,
                    services__provider__user__is_active=True,
                ),
            )
        )
        .filter(total__gt=0)
        .order_by("-total", "name")
        .values("id", "name", "total")[:6]
    )
    total_servicos = servicos_publicados.count()
    total_produtos = produtos_publicados.count()
    categorias = [
        {
            "id": item["id"],
            "name": item["name"],
            "total": item["total"],
            "percentage": round(item["total"] * 100 / total_servicos)
            if total_servicos
            else 0,
        }
        for item in distribuicao_categorias
    ]

    verificacoes_pendentes = Provider.objects.filter(
        verification_status=Provider.VerificationStatus.PENDING,
        verification_submitted_at__isnull=False,
        user__is_active=True,
    )
    utilizadores_recentes = User.objects.order_by("-date_joined", "-pk")[:6]
    atividades = ProviderVerificationAuditEvent.objects.select_related("actor").order_by(
        "-created_at", "-pk"
    )[:8]

    publicacoes_servicos = _contagens_diarias(
        servicos_publicados,
        campo_data="created_at",
        inicio_data_hora=inicio_serie_data_hora,
    )
    publicacoes_produtos = _contagens_diarias(
        produtos_publicados,
        campo_data="created_at",
        inicio_data_hora=inicio_serie_data_hora,
    )
    series = _criar_serie_diaria(
        inicio=inicio_serie,
        dias=periodo,
        valores={
            "registrations": _contagens_diarias(
                User.objects.all(),
                campo_data="date_joined",
                inicio_data_hora=inicio_serie_data_hora,
            ),
            "publications": {
                dia: publicacoes_servicos.get(dia, 0) + publicacoes_produtos.get(dia, 0)
                for dia in publicacoes_servicos.keys() | publicacoes_produtos.keys()
            },
            "service_orders": _contagens_diarias(
                ServiceOrder.objects.all(),
                campo_data="created_at",
                inicio_data_hora=inicio_serie_data_hora,
            ),
            "product_orders": _contagens_diarias(
                ProductOrder.objects.all(),
                campo_data="created_at",
                inicio_data_hora=inicio_serie_data_hora,
            ),
            "conversations": _contagens_diarias(
                Conversation.objects.all(),
                campo_data="created_at",
                inicio_data_hora=inicio_serie_data_hora,
            ),
            "views": _contagens_diarias(
                ListingView.objects.all(),
                campo_data="viewed_at",
                inicio_data_hora=inicio_serie_data_hora,
            ),
        },
    )
    metricas_periodo = {
        "registrations": User.objects.filter(date_joined__gte=inicio_serie_data_hora).count(),
        "publications": (
            servicos_publicados.filter(created_at__gte=inicio_serie_data_hora).count()
            + produtos_publicados.filter(created_at__gte=inicio_serie_data_hora).count()
        ),
        "service_orders": ServiceOrder.objects.filter(
            created_at__gte=inicio_serie_data_hora
        ).count(),
        "product_orders": ProductOrder.objects.filter(
            created_at__gte=inicio_serie_data_hora
        ).count(),
        "conversations": Conversation.objects.filter(
            created_at__gte=inicio_serie_data_hora
        ).count(),
        "views": ListingView.objects.filter(
            viewed_at__gte=inicio_serie_data_hora
        ).count(),
    }

    return {
        "summary": {
            "users_total": User.objects.count(),
            "businesses_total": BusinessProfile.objects.count(),
            "providers_total": Provider.objects.filter(user__is_active=True).count(),
            "services_total": total_servicos,
            "products_total": total_produtos,
            "publications_total": total_servicos + total_produtos,
            "service_orders_total": ServiceOrder.objects.count(),
            "product_orders_total": ProductOrder.objects.count(),
            "conversations_total": Conversation.objects.count(),
            "views_total": ListingView.objects.count(),
            "new_users_30d": User.objects.filter(
                date_joined__gte=agora - timedelta(days=30)
            ).count(),
            "verifications_pending": verificacoes_pendentes.count(),
        },
        "analytics": {
            "period_days": periodo,
            "summary": metricas_periodo,
            "series": series,
        },
        "user_growth": meses,
        "services_by_category": categorias,
        "recent_users": [
            {
                "id": utilizador.pk,
                "email": utilizador.email,
                "created_at": utilizador.date_joined,
                "active": utilizador.is_active,
                "staff": utilizador.is_staff,
            }
            for utilizador in utilizadores_recentes
        ],
        "pending_verifications": [
            {
                "id": prestador.pk,
                "name": prestador.commercial_name,
                "submitted_at": prestador.verification_submitted_at,
            }
            for prestador in verificacoes_pendentes.select_related("user").order_by(
                "verification_submitted_at", "pk"
            )[:8]
        ],
        "recent_activity": [
            {
                "id": evento.pk,
                "provider_name": evento.provider_name_snapshot,
                "previous_status": evento.previous_status,
                "new_status": evento.new_status,
                "actor": evento.actor.email if evento.actor else None,
                "created_at": evento.created_at,
            }
            for evento in atividades
        ],
        "reports_available": False,
    }


def construir_analitica_profissional(*, user, periodo=30):
    agora = timezone.now()
    inicio, inicio_data_hora = _inicio_periodo(agora=agora, dias=periodo)
    provider = Provider.objects.filter(user=user).first()
    if provider is None:
        return None

    servicos, produtos = _publicacoes_ativas(provider)
    propostas = Proposal.objects.filter(provider=provider)
    pedidos_com_proposta = ServiceOrder.objects.filter(proposals__provider=provider).distinct()
    conversas = Conversation.objects.filter(proposal__provider=provider)
    encomendas = ProductOrder.objects.filter(provider=provider)
    visualizacoes = ListingView.objects.filter(provider=provider)

    servicos_novos = _contagens_diarias(
        servicos,
        campo_data="created_at",
        inicio_data_hora=inicio_data_hora,
    )
    produtos_novos = _contagens_diarias(
        produtos,
        campo_data="created_at",
        inicio_data_hora=inicio_data_hora,
    )
    novas_publicacoes = {
        dia: servicos_novos.get(dia, 0) + produtos_novos.get(dia, 0)
        for dia in servicos_novos.keys() | produtos_novos.keys()
    }
    return {
        "period_days": periodo,
        "publications_total": servicos.count() + produtos.count(),
        "summary": {
            "views": visualizacoes.filter(viewed_at__gte=inicio_data_hora).count(),
            "publications": sum(novas_publicacoes.values()),
            "service_orders": pedidos_com_proposta.filter(
                created_at__gte=inicio_data_hora
            ).count(),
            "proposals": propostas.filter(created_at__gte=inicio_data_hora).count(),
            "conversations": conversas.filter(created_at__gte=inicio_data_hora).count(),
            "product_orders": encomendas.filter(created_at__gte=inicio_data_hora).count(),
        },
        "series": _criar_serie_diaria(
            inicio=inicio,
            dias=periodo,
            valores={
                "views": _contagens_diarias(
                    visualizacoes,
                    campo_data="viewed_at",
                    inicio_data_hora=inicio_data_hora,
                ),
                "publications": novas_publicacoes,
                "service_orders": _contagens_diarias(
                    pedidos_com_proposta,
                    campo_data="created_at",
                    inicio_data_hora=inicio_data_hora,
                ),
                "proposals": _contagens_diarias(
                    propostas,
                    campo_data="created_at",
                    inicio_data_hora=inicio_data_hora,
                ),
                "conversations": _contagens_diarias(
                    conversas,
                    campo_data="created_at",
                    inicio_data_hora=inicio_data_hora,
                ),
                "product_orders": _contagens_diarias(
                    encomendas,
                    campo_data="created_at",
                    inicio_data_hora=inicio_data_hora,
                ),
            },
        ),
    }
