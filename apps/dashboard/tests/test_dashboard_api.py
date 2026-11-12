from datetime import timedelta
from uuid import uuid4
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.bookings.models import Booking
from apps.businesses.models import BusinessProfile
from apps.catalog.models import Category, Service
from apps.commerce.models import Product
from apps.locations.models import Municipality, Province
from apps.orders.models import ServiceOrder
from apps.payments.models import Payment
from apps.proposals.models import Proposal
from apps.providers.models import Provider
from apps.reviews.models import Review

from apps.dashboard.models import ListingView
from apps.dashboard.services import _analisar_series_temporais

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class DashboardApiTests(APITestCase):
    def setUp(self):
        provincia = Province.objects.create(name="Luanda", code="LUA")
        municipio = Municipality.objects.create(
            province=provincia,
            name="Talatona",
        )
        self.category = Category.objects.create(name="Tecnologia")
        self.client_user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-123!",
        )
        self.other_client = User.objects.create_user(
            "other-client@example.com",
            "Strong-Password-234!",
        )
        self.provider_user = User.objects.create_user(
            "provider@example.com",
            "Strong-Password-456!",
        )
        self.outsider = User.objects.create_user(
            "outsider@example.com",
            "Strong-Password-789!",
        )
        self.admin_user = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-123!",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            commercial_name="Assistência Luanda",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )
        self.order = ServiceOrder.objects.create(
            client=self.client_user,
            category=self.category,
            title="Reparar computador",
            description="Pedido.",
            municipality=municipio,
            municipality_name_snapshot=municipio.name,
            province_name_snapshot=provincia.name,
            status=ServiceOrder.Status.COMPLETED,
        )
        self.proposal = Proposal.objects.create(
            order=self.order,
            provider=self.provider,
            price="18000.00",
            currency="AOA",
            description="Proposta.",
            estimated_days=2,
            status=Proposal.Status.ACCEPTED,
        )
        self.booking = Booking.objects.create(
            order=self.order,
            proposal=self.proposal,
            client=self.client_user,
            provider=self.provider,
            final_price="18000.00",
            currency="AOA",
            status=Booking.Status.COMPLETED,
        )
        self.payment = Payment.objects.create(
            booking=self.booking,
            amount="18000.00",
            currency="AOA",
            method=Payment.Method.BANK_TRANSFER,
            status=Payment.Status.CONFIRMED,
            reviewed_by=self.admin_user,
        )
        Review.objects.create(booking=self.booking, rating=5)
        Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Reparação",
            description="Assistência técnica.",
            minimum_price="1000.00",
            maximum_price="1000.00",
            currency="AOA",
            price_type=Service.PriceType.FIXED,
            is_active=True,
        )
        Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Consultoria",
            description="Serviço em rascunho.",
            minimum_price=None,
            maximum_price=None,
            currency="AOA",
            price_type=Service.PriceType.ON_REQUEST,
            is_active=False,
        )
        self.url = reverse("dashboard")

    def test__dashboard_exige_authentication(self):
        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__cliente_dashboard_contem_apenas_proprio_activity(self):
        ServiceOrder.objects.create(
            client=self.other_client,
            category=self.category,
            title="Outro pedido",
            description="Privado.",
            municipality=self.order.municipality,
            municipality_name_snapshot="Talatona",
            province_name_snapshot="Luanda",
        )
        self.client.force_authenticate(self.client_user)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resposta.data["client"]["orders_by_status"]["COMPLETED"],
            1,
        )
        self.assertEqual(
            resposta.data["client"]["proposals_received_by_status"]["ACCEPTED"],
            1,
        )
        self.assertEqual(
            resposta.data["client"]["bookings_by_status"]["COMPLETED"],
            1,
        )
        self.assertEqual(
            resposta.data["client"]["payments_by_status"]["CONFIRMED"],
            1,
        )
        self.assertIsNone(resposta.data["provider"])
        self.assertIsNone(resposta.data["platform"])
        self.assertNotIn("email", resposta.data)

    def test__prestador_dashboard_aggregates_business_activity(self):
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.get(self.url)

        provider_data = resposta.data["provider"]
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(provider_data["services"], {"active": 1, "inactive": 1})
        self.assertEqual(provider_data["proposals_by_status"]["ACCEPTED"], 1)
        self.assertEqual(provider_data["bookings_by_status"]["COMPLETED"], 1)
        self.assertEqual(provider_data["reviews"], {"average_rating": "5.00", "count": 1})
        self.assertEqual(provider_data["completed_booking_value"], "18000.00")
        self.assertEqual(provider_data["confirmed_payments_total"], "18000.00")
        self.assertEqual(provider_data["currency"], "AOA")
        self.assertIsNone(resposta.data["platform"])

    def test__utilizador_sem_prestador_gets_vazio_prestador_dashboard(self):
        self.client.force_authenticate(self.outsider)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIsNone(resposta.data["provider"])

    def test__platform_metrics_estao_visible_apenas_para_staff(self):
        self.client.force_authenticate(self.client_user)
        client_response = self.client.get(self.url)
        self.client.force_authenticate(self.admin_user)
        admin_response = self.client.get(self.url)

        self.assertIsNone(client_response.data["platform"])
        platform = admin_response.data["platform"]
        self.assertEqual(platform["users_total"], User.objects.count())
        self.assertEqual(
            platform["providers_by_verification_status"]["VERIFIED"],
            1,
        )
        self.assertEqual(platform["orders_by_status"]["COMPLETED"], 1)
        self.assertEqual(platform["bookings_by_status"]["COMPLETED"], 1)
        self.assertEqual(platform["payments_by_status"]["CONFIRMED"], 1)

    def test__regista_visualizacao_publica_e_deduplica_por_sessao(self):
        payload = {
            "listing_type": ListingView.ListingType.SERVICE,
            "listing_id": Service.objects.get(is_active=True).pk,
            "session_key": str(uuid4()),
        }
        url = reverse("listing-view-event")

        primeira_resposta = self.client.post(url, payload, format="json")
        segunda_resposta = self.client.post(url, payload, format="json")

        self.assertEqual(primeira_resposta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(primeira_resposta.data["recorded"])
        self.assertEqual(segunda_resposta.status_code, status.HTTP_200_OK)
        self.assertFalse(segunda_resposta.data["recorded"])
        self.assertEqual(ListingView.objects.count(), 1)

    def test__prestador_nao_regista_visualizacao_do_proprio_perfil(self):
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.post(
            reverse("listing-view-event"),
            {
                "listing_type": ListingView.ListingType.PROVIDER,
                "listing_id": self.provider.pk,
                "session_key": str(uuid4()),
            },
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertFalse(resposta.data["recorded"])
        self.assertEqual(ListingView.objects.count(), 0)

    def test__analitica_profissional_respeita_periodo_e_agrega_dias(self):
        visualizacao = ListingView.objects.create(
            listing_type=ListingView.ListingType.SERVICE,
            listing_id=Service.objects.get(is_active=True).pk,
            provider=self.provider,
            session_hash="a" * 64,
        )
        ListingView.objects.filter(pk=visualizacao.pk).update(
            viewed_at=timezone.now() - timedelta(days=2)
        )
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.get(reverse("dashboard-analytics"), {"period": 7})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["period_days"], 7)
        self.assertEqual(resposta.data["summary"]["views"], 1)
        self.assertEqual(resposta.data["summary"]["service_orders"], 1)
        self.assertEqual(len(resposta.data["series"]), 7)
        self.assertEqual(sum(dia["views"] for dia in resposta.data["series"]), 1)

    def test__analitica_administrativa_soma_servicos_e_produtos_no_mesmo_dia(self):
        Product.objects.create(
            provider=self.provider,
            category=self.category,
            name="Computador",
            price="50000.00",
            stock_quantity=3,
            is_active=True,
        )
        self.client.force_authenticate(self.admin_user)

        resposta = self.client.get(reverse("admin-dashboard"), {"period": 7})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["summary"]["publications_total"], 2)
        hoje = timezone.localdate().isoformat()
        linha_hoje = next(linha for linha in resposta.data["analytics"]["series"] if linha["date"] == hoje)
        self.assertEqual(linha_hoje["publications"], 2)

    def test__painel_administrativo_disponibiliza_crescimento_e_aprovacoes_reais(self):
        BusinessProfile.objects.create(
            provider=self.provider,
            registered_name="Assistência Luanda, Lda.",
        )
        pending_user = User.objects.create_user(
            "pending-business@example.com",
            "Strong-Password-567!",
        )
        pending_provider = Provider.objects.create(
            user=pending_user,
            commercial_name="Empresa por verificar",
            verification_status=Provider.VerificationStatus.PENDING,
            verification_submitted_at=timezone.now(),
        )
        BusinessProfile.objects.create(
            provider=pending_provider,
            registered_name="Empresa por verificar, Lda.",
        )
        self.client.force_authenticate(self.admin_user)

        resposta = self.client.get(reverse("admin-dashboard"), {"period": 30})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["summary"]["businesses_total"], 2)
        self.assertEqual(
            resposta.data["summary"]["business_verifications_pending"],
            1,
        )
        self.assertEqual(resposta.data["summary"]["inactive_services"], 1)
        self.assertEqual(len(resposta.data["business_growth"]), 12)
        mes_atual = timezone.localdate().strftime("%Y-%m")
        crescimento_atual = next(
            item
            for item in resposta.data["business_growth"]
            if item["month"] == mes_atual
        )
        self.assertEqual(crescimento_atual["businesses"], 2)
        self.assertEqual(
            resposta.data["pending_businesses"][0]["registered_name"],
            "Empresa por verificar, Lda.",
        )
        self.assertEqual(
            resposta.data["inactive_services"][0]["name"],
            "Consultoria",
        )
        self.assertFalse(resposta.data["reports_available"])

    def test__painel_administrativo_compara_periodos_equivalentes(self):
        agora = timezone.now()
        utilizador_anterior = User.objects.create_user(
            "previous-period@example.com",
            "Strong-Password-890!",
        )
        utilizador_atual = User.objects.create_user(
            "current-period@example.com",
            "Strong-Password-901!",
        )
        User.objects.filter(pk=utilizador_anterior.pk).update(
            date_joined=agora - timedelta(days=9)
        )
        User.objects.filter(pk=utilizador_atual.pk).update(
            date_joined=agora - timedelta(days=2)
        )
        self.client.force_authenticate(self.admin_user)

        resposta = self.client.get(reverse("admin-dashboard"), {"period": 7})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        comparacao = resposta.data["period_comparison"]
        registrations = comparacao["metrics"]["registrations"]
        self.assertEqual(comparacao["period_days"], 7)
        self.assertEqual(registrations["current"], resposta.data["analytics"]["summary"]["registrations"])
        self.assertEqual(registrations["previous"], 1)
        self.assertEqual(
            registrations["change"],
            registrations["current"] - registrations["previous"],
        )
        self.assertEqual(len(resposta.data["analytics"]["series"]), 7)
        analise = resposta.data["analytics"]["analysis"]
        self.assertEqual(analise["method"], "ordinary_least_squares")
        self.assertEqual(analise["rolling_window_days"], 7)
        self.assertEqual(
            analise["metrics"]["registrations"]["total"],
            registrations["current"],
        )
        self.assertIn("registrations_average_7d", resposta.data["analytics"]["series"][-1])
        self.assertEqual(
            sum(item["registrations"] for item in resposta.data["analytics"]["series"]),
            registrations["current"],
        )

    def test__funil_de_pedidos_usa_a_coorte_do_periodo_e_calcula_conversoes(self):
        ServiceOrder.objects.create(
            client=self.other_client,
            category=self.category,
            title="Instalar equipamento",
            description="Pedido ainda sem propostas.",
            municipality=self.order.municipality,
            municipality_name_snapshot=self.order.municipality_name_snapshot,
            province_name_snapshot=self.order.province_name_snapshot,
        )
        self.client.force_authenticate(self.admin_user)

        resposta = self.client.get(reverse("admin-dashboard"), {"period": 7})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        funil = resposta.data["service_order_funnel"]
        self.assertEqual(
            [etapa["count"] for etapa in funil["stages"]],
            [2, 1, 1, 1],
        )
        self.assertEqual(
            [etapa["conversion_from_previous"] for etapa in funil["stages"]],
            [None, 50.0, 100.0, 100.0],
        )
        self.assertEqual(
            funil["cohort_start"],
            resposta.data["period_comparison"]["current_start"],
        )
        self.assertEqual(
            funil["cohort_end"],
            resposta.data["period_comparison"]["current_end"],
        )

    def test__funil_de_pedidos_devolve_etapas_vazias_sem_divisao_por_zero(self):
        ServiceOrder.objects.filter(pk=self.order.pk).update(
            created_at=timezone.now() - timedelta(days=8)
        )
        self.client.force_authenticate(self.admin_user)

        resposta = self.client.get(reverse("admin-dashboard"), {"period": 7})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [etapa["count"] for etapa in resposta.data["service_order_funnel"]["stages"]],
            [0, 0, 0, 0],
        )
        self.assertEqual(
            [
                etapa["conversion_from_previous"]
                for etapa in resposta.data["service_order_funnel"]["stages"]
            ],
            [None, None, None, None],
        )

    def test__analise_temporal_calcula_media_movel_e_tendencia(self):
        serie = [
            {"date": f"2025-01-{dia:02d}", "views": dia - 1}
            for dia in range(1, 8)
        ]

        resultado = _analisar_series_temporais(serie, ["views"])

        self.assertEqual(resultado["method"], "ordinary_least_squares")
        self.assertEqual(resultado["rolling_window_days"], 7)
        self.assertEqual(resultado["metrics"]["views"]["total"], 21)
        self.assertEqual(resultado["metrics"]["views"]["daily_average"], 3)
        self.assertEqual(resultado["metrics"]["views"]["active_days"], 6)
        self.assertEqual(resultado["metrics"]["views"]["zero_days"], 1)
        self.assertEqual(resultado["metrics"]["views"]["trend_per_day"], 1)
        self.assertEqual(resultado["metrics"]["views"]["trend_direction"], "increasing")
        self.assertEqual(resultado["metrics"]["views"]["r_squared"], 1)
        self.assertEqual(resultado["series"][-1]["views_average_7d"], 3)

    def test__analise_temporal_identifica_series_constantes_e_sem_variancia(self):
        serie = [
            {"date": f"2025-01-{dia:02d}", "registrations": 0}
            for dia in range(1, 4)
        ]

        resultado = _analisar_series_temporais(serie, ["registrations"])

        self.assertEqual(resultado["metrics"]["registrations"]["total"], 0)
        self.assertEqual(resultado["metrics"]["registrations"]["trend_direction"], "stable")
        self.assertEqual(
            resultado["metrics"]["registrations"]["daily_standard_deviation"],
            0,
        )
        self.assertIsNone(resultado["metrics"]["registrations"]["r_squared"])
        self.assertEqual(
            [item["registrations_average_7d"] for item in resultado["series"]],
            [None, None, None],
        )

    def test__analise_temporal_identifica_tendencia_decrescente(self):
        serie = [
            {"date": f"2025-01-{dia:02d}", "views": 7 - dia}
            for dia in range(1, 8)
        ]

        resultado = _analisar_series_temporais(serie, ["views"])

        self.assertEqual(resultado["metrics"]["views"]["trend_per_day"], -1)
        self.assertEqual(resultado["metrics"]["views"]["trend_direction"], "decreasing")
        self.assertEqual(resultado["metrics"]["views"]["r_squared"], 1)

    def test__periodo_de_analise_e_validado(self):
        self.client.force_authenticate(self.admin_user)

        resposta = self.client.get(reverse("admin-dashboard"), {"period": 14})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("period", resposta.data)

    def test__registo_de_visualizacao_tem_rate_limit(self):
        payload = {
            "listing_type": ListingView.ListingType.PROVIDER,
            "listing_id": self.provider.pk,
            "session_key": str(uuid4()),
        }
        url = reverse("listing-view-event")

        cache.clear()
        with patch.object(
            ScopedRateThrottle,
            "THROTTLE_RATES",
            {"analytics_view": "1/minute"},
        ):
            primeira_resposta = self.client.post(url, payload, format="json")
            segunda_resposta = self.client.post(
                url,
                {**payload, "session_key": str(uuid4())},
                format="json",
            )

        self.assertEqual(primeira_resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(segunda_resposta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
