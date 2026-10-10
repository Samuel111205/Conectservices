from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category
from apps.locations.models import Municipality, Province, ProviderCoverage
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ServiceOrderApiTests(APITestCase):
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
        self.client_user = User.objects.create_user(
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
        )
        self.list_url = reverse("order-list")

    def order_payload(self, **overrides):
        return {
            "category": self.category.pk,
            "title": "Reparar computador",
            "description": "O computador não inicia.",
            "minimum_budget": "10000.00",
            "maximum_budget": "30000.00",
            "municipality": self.municipality.pk,
            "neighborhood": "Talatona",
            "address": "Rua privada, 20",
            **overrides,
        }

    def test__pedido_creation_exige_authentication(self):
        resposta = self.client.post(self.list_url, self.order_payload())

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__cliente_cria_pedido_com_server_owned_campos_and_localizacao_snapshot(self):
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(self.list_url, self.order_payload())

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        pedido = ServiceOrder.objects.get(pk=resposta.data["id"])
        self.assertEqual(pedido.client, self.client_user)
        self.assertEqual(pedido.status, ServiceOrder.Status.OPEN)
        self.assertEqual(pedido.currency, "AOA")
        self.assertEqual(pedido.municipality_name_snapshot, "Talatona")
        self.assertEqual(pedido.province_name_snapshot, "Luanda")
        self.assertNotIn("client_id", resposta.data)

    def test__cliente_nao_pode_choose_pedido_proprietario_ou_estado(self):
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            self.list_url,
            self.order_payload(
                client_id=self.provider_user.pk,
                status=ServiceOrder.Status.AWARDED,
            ),
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ServiceOrder.objects.exists())

    def test__invalido_budget_and_coordinate_pair_estao_rejected(self):
        self.client.force_authenticate(self.client_user)
        invalid_budget = self.client.post(
            self.list_url,
            self.order_payload(
                minimum_budget="30000.00",
                maximum_budget="10000.00",
            ),
        )
        invalid_location = self.client.post(
            self.list_url,
            self.order_payload(latitude="-8.9"),
        )

        self.assertEqual(invalid_budget.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_location.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ServiceOrder.objects.exists())

    def test__requested_duration_esta_validated_and_exposed_em_prestador_opportunity(self):
        self.client.force_authenticate(self.client_user)
        invalid = self.client.post(
            self.list_url,
            self.order_payload(requested_duration_minutes=1441),
        )
        valid = self.client.post(
            self.list_url,
            self.order_payload(requested_duration_minutes=90),
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(valid.status_code, status.HTTP_201_CREATED)
        pedido = ServiceOrder.objects.get(pk=valid.data["id"])
        self.provider.mark_verified()
        self.client.force_authenticate(self.provider_user)

        opportunities = self.client.get(reverse("order-opportunities"))

        self.assertEqual(opportunities.data["count"], 1)
        self.assertEqual(
            opportunities.data["results"][0]["requested_duration_minutes"],
            pedido.requested_duration_minutes,
        )

    def test__pedido_listar_and_detail_estao_private_para_cliente(self):
        pedido = ServiceOrder.objects.create(
            client=self.client_user,
            category=self.category,
            title="Pedido privado",
            description="Descrição",
            municipality=self.municipality,
            municipality_name_snapshot=self.municipality.name,
            province_name_snapshot=self.province.name,
            address_snapshot="Morada privada",
        )
        self.client.force_authenticate(self.provider_user)

        list_response = self.client.get(self.list_url)
        detail_response = self.client.get(
            reverse("order-detail", args=(pedido.pk,))
        )

        self.assertEqual(list_response.data["count"], 0)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test__verificado_prestador_sees_sanitized_opportunities(self):
        self.provider.mark_verified()
        ProviderCoverage.objects.create(
            provider=self.provider,
            municipality=self.municipality,
        )
        ServiceOrder.objects.create(
            client=self.client_user,
            category=self.category,
            title="Pedido disponível",
            description="Descrição pública",
            municipality=self.municipality,
            municipality_name_snapshot=self.municipality.name,
            province_name_snapshot=self.province.name,
            neighborhood_snapshot="Talatona",
            address_snapshot="Morada privada",
            latitude_snapshot=Decimal("-8.9000000"),
            longitude_snapshot=Decimal("13.2000000"),
        )
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.get(reverse("order-opportunities"))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["count"], 1)
        elemento = resposta.data["results"][0]
        self.assertIn("neighborhood_snapshot", elemento)
        self.assertNotIn("address_snapshot", elemento)
        self.assertNotIn("latitude_snapshot", elemento)
        self.assertNotIn("longitude_snapshot", elemento)
        self.assertNotIn("client_id", elemento)

    def test__unverified_prestador_nao_pode_listar_opportunities(self):
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.get(reverse("order-opportunities"))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test__prestador_coverage_limits_opportunities(self):
        self.provider.mark_verified()
        ProviderCoverage.objects.create(
            provider=self.provider,
            municipality=self.municipality,
        )
        primeiro = ServiceOrder.objects.create(
            client=self.client_user,
            category=self.category,
            title="Talatona",
            description="Pedido",
            municipality=self.municipality,
            municipality_name_snapshot="Talatona",
            province_name_snapshot="Luanda",
        )
        ServiceOrder.objects.create(
            client=self.client_user,
            category=self.category,
            title="Belas",
            description="Pedido",
            municipality=self.other_municipality,
            municipality_name_snapshot="Belas",
            province_name_snapshot="Luanda",
        )
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.get(reverse("order-opportunities"))

        self.assertEqual(resposta.data["count"], 1)
        self.assertEqual(resposta.data["results"][0]["id"], primeiro.pk)

    def test__cliente_pode_cancelar_proprio_open_pedido_and_pendente_propostas_estao_rejected(self):
        pedido = ServiceOrder.objects.create(
            client=self.client_user,
            category=self.category,
            title="Cancelar",
            description="Pedido",
            municipality=self.municipality,
            municipality_name_snapshot="Talatona",
            province_name_snapshot="Luanda",
        )
        proposta = Proposal.objects.create(
            order=pedido,
            provider=self.provider,
            price=Decimal("15000.00"),
            currency="AOA",
            description="Proposta",
            estimated_days=2,
        )
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("order-cancel", args=(pedido.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        pedido.refresh_from_db()
        proposta.refresh_from_db()
        self.assertEqual(pedido.status, ServiceOrder.Status.CANCELLED)
        self.assertEqual(proposta.status, Proposal.Status.REJECTED)

    def test__outro_utilizador_nao_pode_cancelar_pedido(self):
        pedido = ServiceOrder.objects.create(
            client=self.client_user,
            category=self.category,
            title="Pedido",
            description="Pedido",
            municipality=self.municipality,
            municipality_name_snapshot="Talatona",
            province_name_snapshot="Luanda",
        )
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.post(reverse("order-cancel", args=(pedido.pk,)))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
