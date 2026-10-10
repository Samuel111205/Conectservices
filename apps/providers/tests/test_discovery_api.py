from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bookings.models import Booking
from apps.catalog.models import Category, Service
from apps.locations.models import Municipality, Province, ProviderCoverage
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider
from apps.reviews.models import Review

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ProviderDiscoveryApiTests(APITestCase):
    def setUp(self):
        self.province = Province.objects.create(name="Luanda", code="LUA")
        self.municipality = Municipality.objects.create(
            province=self.province,
            name="Talatona",
        )
        self.other_municipality = Municipality.objects.create(
            province=self.province,
            name="Belas",
        )
        self.category = Category.objects.create(name="Tecnologia")
        self.other_category = Category.objects.create(name="Canalização")
        self.user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-123!",
        )
        self.provider_user = User.objects.create_user(
            "provider@example.com",
            "Strong-Password-456!",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            commercial_name="Assistência Luanda",
            description="Reparação de computadores.",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )
        self.create_service(self.provider, self.category, "Computadores")
        self.coverage = ProviderCoverage.objects.create(
            provider=self.provider,
            municipality=self.municipality,
        )
        self.url = reverse("provider-discover")

    def create_service(self, provider, category, name, *, active=True):
        return Service.objects.create(
            provider=provider,
            category=category,
            name=name,
            description="Serviço publicado.",
            minimum_price="1000.00",
            maximum_price="1000.00",
            currency="AOA",
            price_type=Service.PriceType.FIXED,
            is_active=active,
        )

    def add_review(self, rating):
        pedido = ServiceOrder.objects.create(
            client=self.user,
            category=self.category,
            title=f"Pedido {rating}",
            description="Pedido.",
            municipality=self.municipality,
            municipality_name_snapshot=self.municipality.name,
            province_name_snapshot=self.province.name,
            status=ServiceOrder.Status.COMPLETED,
        )
        proposta = Proposal.objects.create(
            order=pedido,
            provider=self.provider,
            price="1000.00",
            currency="AOA",
            description="Proposta.",
            estimated_days=1,
            status=Proposal.Status.ACCEPTED,
        )
        contratacao = Booking.objects.create(
            order=pedido,
            proposal=proposta,
            client=self.user,
            provider=self.provider,
            final_price="1000.00",
            currency="AOA",
            status=Booking.Status.COMPLETED,
        )
        Review.objects.create(booking=contratacao, rating=rating)

    def test__public_discovery_lists_apenas_verificado_active_prestadores_com_servicos(self):
        pending_user = User.objects.create_user(
            "pending@example.com",
            "Strong-Password-789!",
        )
        pending = Provider.objects.create(
            user=pending_user,
            commercial_name="Prestador pendente",
        )
        self.create_service(pending, self.category, "Serviço pendente")

        no_service_user = User.objects.create_user(
            "no-service@example.com",
            "Strong-Password-101!",
        )
        Provider.objects.create(
            user=no_service_user,
            commercial_name="Sem serviços",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["count"], 1)
        self.assertEqual(resposta.data["results"][0]["id"], self.provider.pk)
        self.assertNotIn("business_email", resposta.data["results"][0])
        self.assertNotIn("user", resposta.data["results"][0])

    def test__search_categoria_municipio_and_ordering_filters(self):
        second_user = User.objects.create_user(
            "other-provider@example.com",
            "Strong-Password-202!",
        )
        second_provider = Provider.objects.create(
            user=second_user,
            commercial_name="Melhor Reparação",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )
        self.create_service(second_provider, self.category, "Portáteis")
        ProviderCoverage.objects.create(
            provider=second_provider,
            municipality=self.other_municipality,
        )

        pesquisa = self.client.get(self.url, {"search": "portáteis"})
        categoria = self.client.get(
            self.url,
            {"category": self.category.pk},
        )
        municipio = self.client.get(
            self.url,
            {"municipality": self.other_municipality.pk},
        )
        invalid = self.client.get(self.url, {"ordering": "email"})

        self.assertEqual(pesquisa.data["count"], 1)
        self.assertEqual(pesquisa.data["results"][0]["id"], second_provider.pk)
        self.assertEqual(categoria.data["count"], 2)
        self.assertEqual(municipio.data["count"], 1)
        self.assertEqual(municipio.data["results"][0]["id"], second_provider.pk)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test__discovery_includes_avaliacao_aggregate_and_ranking(self):
        self.add_review(4)
        self.add_review(5)

        resposta = self.client.get(self.url, {"ordering": "-rating"})

        self.assertEqual(resposta.data["results"][0]["average_rating"], "4.50")
        self.assertEqual(resposta.data["results"][0]["review_count"], 2)
        self.assertEqual(resposta.data["results"][0]["active_service_count"], 1)

    def test__inactive_servico_and_coverage_do_nao_make_prestador_discoverable(self):
        self.provider.verification_status = Provider.VerificationStatus.VERIFIED
        self.provider.save(update_fields=("verification_status",))
        Service.objects.filter(provider=self.provider).update(is_active=False)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.data["count"], 0)

    def test__invalido_categoria_and_municipio_filters_estao_reported(self):
        category_response = self.client.get(self.url, {"category": "invalid"})
        municipality_response = self.client.get(
            self.url,
            {"municipality": "invalid"},
        )

        self.assertEqual(category_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            municipality_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
