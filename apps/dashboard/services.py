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


def _contagem_periodo(queryset, *, campo_data, inicio_data_hora, fim_data_hora):
    return queryset.filter(
        **{
            f"{campo_data}__gte": inicio_data_hora,
            f"{campo_data}__lt": fim_data_hora,
        }
    ).count()


def _funil_pedidos_servico(*, inicio, fim):
    pedidos = ServiceOrder.objects.filter(created_at__gte=inicio, created_at__lt=fim)
    etapas = [
        ("orders", "Pedidos criados", pedidos.count()),
        (
            "proposals",
            "Com proposta",
            pedidos.filter(proposals__isnull=False).distinct().count(),
        ),
        (
            "bookings",
            "Contratados",
            pedidos.filter(booking__isnull=False).count(),
        ),
        (
            "completed",
            "Concluídos",
            pedidos.filter(booking__status=Booking.Status.COMPLETED).count(),
        ),
    ]

    resultado = []
    etapa_anterior = None
    for chave, nome, total in etapas:
        resultado.append(
            {
                "key": chave,
                "name": nome,
                "count": total,
                "conversion_from_previous": (
                    round(total * 100 / etapa_anterior, 1)
                    if etapa_anterior
                    else None
                ),
            }
        )
        etapa_anterior = total

    return {
        "cohort_start": timezone.localdate(inicio).isoformat(),
        "cohort_end": (timezone.localdate(fim) - timedelta(days=1)).isoformat(),
        "stages": resultado,
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


def _analisar_series_temporais(series, metricas, *, janela=7):
    """Apply rolling averages and descriptive linear trends to daily counts."""
    quadro = pd.DataFrame(series)
    analise = {}

    for metrica in metricas:
        valores = quadro[metrica].astype("float64")
        dias = pd.Series(range(len(valores)), dtype="float64")
        media = float(valores.mean()) if len(valores) else 0.0
        desvio_padrao = (
            float(valores.std(ddof=1))
            if len(valores) > 1
            else None
        )

        variacao_dias = dias - dias.mean()
        soma_quadrados_dias = float((variacao_dias**2).sum())
        declive = (
            float((variacao_dias * (valores - media)).sum() / soma_quadrados_dias)
            if soma_quadrados_dias
            else 0.0
        )
        correlacao = valores.corr(dias) if valores.nunique() > 1 else None
        r_quadrado = (
            float(correlacao**2)
            if correlacao is not None and pd.notna(correlacao)
            else None
        )

        quadro[f"{metrica}_average_7d"] = valores.rolling(
            window=janela,
            min_periods=janela,
        ).mean()
        analise[metrica] = {
            "total": int(valores.sum()),
            "daily_average": round(media, 2),
            "daily_standard_deviation": (
                round(desvio_padrao, 2) if desvio_padrao is not None else None
            ),
            "active_days": int((valores > 0).sum()),
            "zero_days": int((valores == 0).sum()),
            "trend_per_day": round(declive, 4),
            "trend_direction": (
                "increasing" if declive > 0 else "decreasing" if declive < 0 else "stable"
            ),
            "r_squared": round(r_quadrado, 4) if r_quadrado is not None else None,
        }

    serie_resultado = []
    for _, linha in quadro.iterrows():
        registo = {"date": linha["date"]}
        for coluna, valor in linha.items():
            if coluna == "date":
                continue
            if coluna.endswith("_average_7d"):
                registo[coluna] = round(float(valor), 2) if pd.notna(valor) else None
            else:
                registo[coluna] = int(valor)
        serie_resultado.append(registo)

    return {
        "method": "ordinary_least_squares",
        "rolling_window_days": janela,
        "metrics": analise,
        "series": serie_resultado,
    }


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
    fim_serie = inicio_serie + timedelta(days=periodo)
    fim_serie_data_hora = inicio_serie_data_hora + timedelta(days=periodo)
    funil_pedidos_servico = _funil_pedidos_servico(
        inicio=inicio_serie_data_hora,
        fim=fim_serie_data_hora,
    )
    inicio_periodo_anterior = inicio_serie - timedelta(days=periodo)
    inicio_periodo_anterior_data_hora = inicio_serie_data_hora - timedelta(days=periodo)
    servicos_publicados, produtos_publicados = _publicacoes_ativas()

    utilizadores_por_mes = {
        linha["mes"].strftime("%Y-%m"): linha["total"]
        for linha in User.objects.filter(date_joined__gte=inicio_periodo)
        .annotate(mes=TruncMonth("date_joined"))
        .values("mes")
        .annotate(total=Count("pk"))
        .order_by("mes")
    }
    empresas_por_mes = {
        linha["mes"].strftime("%Y-%m"): linha["total"]
        for linha in BusinessProfile.objects.filter(created_at__gte=inicio_periodo)
        .annotate(mes=TruncMonth("created_at"))
        .values("mes")
        .annotate(total=Count("pk"))
        .order_by("mes")
    }
    meses = []
    crescimento_empresas = []
    mes_atual = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for deslocamento in range(11, -1, -1):
        ano = mes_atual.year
        mes = mes_atual.month - deslocamento
        while mes <= 0:
            mes += 12
            ano -= 1
        chave = f"{ano:04d}-{mes:02d}"
        meses.append({"month": chave, "users": utilizadores_por_mes.get(chave, 0)})
        crescimento_empresas.append(
            {"month": chave, "businesses": empresas_por_mes.get(chave, 0)}
        )

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
    empresas_pendentes = BusinessProfile.objects.filter(
        provider__verification_status=Provider.VerificationStatus.PENDING,
        provider__verification_submitted_at__isnull=False,
        provider__user__is_active=True,
    )
    servicos_inativos = Service.objects.filter(is_active=False)
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
    analise_series = _analisar_series_temporais(
        series,
        (chave for chave in series[0] if chave != "date"),
    )
    series = analise_series["series"]
    metricas_periodo = {
        "registrations": _contagem_periodo(
            User.objects.all(),
            campo_data="date_joined",
            inicio_data_hora=inicio_serie_data_hora,
            fim_data_hora=fim_serie_data_hora,
        ),
        "publications": (
            _contagem_periodo(
                servicos_publicados,
                campo_data="created_at",
                inicio_data_hora=inicio_serie_data_hora,
                fim_data_hora=fim_serie_data_hora,
            )
            + _contagem_periodo(
                produtos_publicados,
                campo_data="created_at",
                inicio_data_hora=inicio_serie_data_hora,
                fim_data_hora=fim_serie_data_hora,
            )
        ),
        "service_orders": _contagem_periodo(
            ServiceOrder.objects.all(),
            campo_data="created_at",
            inicio_data_hora=inicio_serie_data_hora,
            fim_data_hora=fim_serie_data_hora,
        ),
        "product_orders": _contagem_periodo(
            ProductOrder.objects.all(),
            campo_data="created_at",
            inicio_data_hora=inicio_serie_data_hora,
            fim_data_hora=fim_serie_data_hora,
        ),
        "conversations": _contagem_periodo(
            Conversation.objects.all(),
            campo_data="created_at",
            inicio_data_hora=inicio_serie_data_hora,
            fim_data_hora=fim_serie_data_hora,
        ),
        "views": _contagem_periodo(
            ListingView.objects.all(),
            campo_data="viewed_at",
            inicio_data_hora=inicio_serie_data_hora,
            fim_data_hora=fim_serie_data_hora,
        ),
    }
    metricas_periodo_anterior = {
        "registrations": _contagem_periodo(
            User.objects.all(),
            campo_data="date_joined",
            inicio_data_hora=inicio_periodo_anterior_data_hora,
            fim_data_hora=inicio_serie_data_hora,
        ),
        "publications": (
            _contagem_periodo(
                servicos_publicados,
                campo_data="created_at",
                inicio_data_hora=inicio_periodo_anterior_data_hora,
                fim_data_hora=inicio_serie_data_hora,
            )
            + _contagem_periodo(
                produtos_publicados,
                campo_data="created_at",
                inicio_data_hora=inicio_periodo_anterior_data_hora,
                fim_data_hora=inicio_serie_data_hora,
            )
        ),
        "service_orders": _contagem_periodo(
            ServiceOrder.objects.all(),
            campo_data="created_at",
            inicio_data_hora=inicio_periodo_anterior_data_hora,
            fim_data_hora=inicio_serie_data_hora,
        ),
        "product_orders": _contagem_periodo(
            ProductOrder.objects.all(),
            campo_data="created_at",
            inicio_data_hora=inicio_periodo_anterior_data_hora,
            fim_data_hora=inicio_serie_data_hora,
        ),
        "conversations": _contagem_periodo(
            Conversation.objects.all(),
            campo_data="created_at",
            inicio_data_hora=inicio_periodo_anterior_data_hora,
            fim_data_hora=inicio_serie_data_hora,
        ),
        "views": _contagem_periodo(
            ListingView.objects.all(),
            campo_data="viewed_at",
            inicio_data_hora=inicio_periodo_anterior_data_hora,
            fim_data_hora=inicio_serie_data_hora,
        ),
    }
    comparacao_periodo = {}
    for metrica, atual in metricas_periodo.items():
        anterior = metricas_periodo_anterior[metrica]
        variacao = atual - anterior
        comparacao_periodo[metrica] = {
            "current": atual,
            "previous": anterior,
            "change": variacao,
            "change_percent": (
                round(variacao * 100 / anterior, 1)
                if anterior
                else (0 if atual == 0 else None)
            ),
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
            "business_verifications_pending": empresas_pendentes.count(),
            "inactive_services": servicos_inativos.count(),
        },
        "analytics": {
            "period_days": periodo,
            "summary": metricas_periodo,
            "series": series,
            "analysis": {
                "method": analise_series["method"],
                "rolling_window_days": analise_series["rolling_window_days"],
                "metrics": analise_series["metrics"],
            },
        },
        "period_comparison": {
            "period_days": periodo,
            "current_start": inicio_serie.isoformat(),
            "current_end": (fim_serie - timedelta(days=1)).isoformat(),
            "previous_start": inicio_periodo_anterior.isoformat(),
            "previous_end": (inicio_serie - timedelta(days=1)).isoformat(),
            "metrics": comparacao_periodo,
        },
        "service_order_funnel": funil_pedidos_servico,
        "user_growth": meses,
        "business_growth": crescimento_empresas,
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
        "pending_businesses": [
            {
                "id": empresa.pk,
                "name": empresa.provider.commercial_name,
                "registered_name": empresa.registered_name,
                "email": empresa.provider.user.email,
                "submitted_at": empresa.provider.verification_submitted_at,
            }
            for empresa in empresas_pendentes.select_related(
                "provider",
                "provider__user",
            ).order_by("provider__verification_submitted_at", "pk")[:8]
        ],
        "inactive_services": [
            {
                "id": servico.pk,
                "name": servico.name,
                "provider_name": servico.provider.commercial_name,
                "created_at": servico.created_at,
            }
            for servico in servicos_inativos.select_related("provider").order_by(
                "-created_at", "-pk"
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
