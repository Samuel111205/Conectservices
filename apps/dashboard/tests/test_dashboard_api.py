from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bookings.models import Booking
from apps.catalog.models import Category, Service
from apps.locations.models import Municipality, Province
from apps.orders.models import ServiceOrder
from apps.payments.models import Payment
from apps.proposals.models import Proposal
from apps.providers.models import Provider
from apps.reviews.models import Review

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
