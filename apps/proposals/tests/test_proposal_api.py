from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Service
from apps.bookings.models import Booking
from apps.locations.models import Municipality, Province
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ProposalApiTests(APITestCase):
    def setUp(self):
        self.province = Province.objects.create(name="Luanda", code="LUA")
        self.municipality = Municipality.objects.create(
            province=self.province,
            name="Talatona",
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
        self.other_provider_user = User.objects.create_user(
            "other@example.com",
            "Strong-Password-789!",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            commercial_name="Assistência Luanda",
        )
        self.other_provider = Provider.objects.create(
            user=self.other_provider_user,
            commercial_name="Outro prestador",
        )
        self.provider.mark_verified()
        self.other_provider.mark_verified()
        self.order = self.create_order()
        self.list_url = reverse("proposal-list")

    def create_order(self, *, client=None, **overrides):
        fields = {
            "category": self.category,
            "title": "Reparar computador",
            "description": "Pedido de assistência.",
            "municipality": self.municipality,
            "municipality_name_snapshot": "Talatona",
            "province_name_snapshot": "Luanda",
            "requested_duration_minutes": 60,
        }
        fields.update(overrides)
        return ServiceOrder.objects.create(
            client=client or self.client_user,
            **fields,
        )

    def proposal_payload(self, **overrides):
        return {
            "order_id": self.order.pk,
            "price": "18000.00",
            "description": "Reparação completa.",
            "estimated_days": 2,
            **overrides,
        }

    def test__proposta_exige_authentication(self):
        resposta = self.client.post(self.list_url, self.proposal_payload())

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__verificado_prestador_pode_submit_proposta(self):
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.post(self.list_url, self.proposal_payload())

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        proposta = Proposal.objects.get(pk=resposta.data["id"])
        self.assertEqual(proposta.provider, self.provider)
        self.assertEqual(proposta.status, Proposal.Status.PENDING)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, ServiceOrder.Status.NEGOTIATING)
        self.assertEqual(resposta.data["currency"], "AOA")

    def test__pendente_ou_suspended_prestador_nao_pode_submit_proposta(self):
        self.provider.verification_status = Provider.VerificationStatus.SUSPENDED
        self.provider.save(update_fields=("verification_status", "updated_at"))
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.post(self.list_url, self.proposal_payload())

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Proposal.objects.exists())

    def test__prestador_nao_pode_send_proposta_para_proprio_pedido(self):
        own_order = self.create_order(
            client=self.provider_user,
            title="Pedido do prestador",
        )
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.post(
            self.list_url,
            self.proposal_payload(order_id=own_order.pk),
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__duplicado_proposta_esta_rejected(self):
        self.client.force_authenticate(self.provider_user)
        primeiro = self.client.post(self.list_url, self.proposal_payload())
        duplicate = self.client.post(self.list_url, self.proposal_payload())

        self.assertEqual(primeiro.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Proposal.objects.filter(order=self.order).count(), 1)

    def test__nao_pode_submit_proposta_para_cancelado_pedido(self):
        self.order.status = ServiceOrder.Status.CANCELLED
        self.order.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.post(self.list_url, self.proposal_payload())

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__servico_em_proposta_deve_belong_para_prestador_and_categoria(self):
        servico = Service.objects.create(
            provider=self.other_provider,
            category=self.category,
            name="Serviço alheio",
            minimum_price=Decimal("10000.00"),
            maximum_price=Decimal("10000.00"),
            currency="AOA",
            price_type=Service.PriceType.FIXED,
            is_active=True,
        )
        self.client.force_authenticate(self.provider_user)

        resposta = self.client.post(
            self.list_url,
            self.proposal_payload(service=servico.pk),
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__cliente_sees_propostas_para_proprio_pedidos_but_other_cliente_nao(self):
        self.client.force_authenticate(self.provider_user)
        self.client.post(self.list_url, self.proposal_payload())
        outsider = User.objects.create_user(
            "outsider@example.com",
            "Strong-Password-101!",
        )
        self.client.force_authenticate(self.client_user)
        own_response = self.client.get(self.list_url)
        self.client.force_authenticate(outsider)
        outsider_response = self.client.get(self.list_url)

        self.assertEqual(own_response.data["count"], 1)
        self.assertEqual(outsider_response.data["count"], 0)

    def test__prestador_pode_cancelar_apenas_proprio_pendente_proposta(self):
        self.client.force_authenticate(self.provider_user)
        resposta = self.client.post(self.list_url, self.proposal_payload())
        id_proposta = resposta.data["id"]

        cancel_response = self.client.post(
            reverse("proposal-cancel", args=(id_proposta,))
        )

        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.data["status"], Proposal.Status.CANCELLED)

    def test__cliente_pode_rejeitar_pendente_proposta(self):
        self.client.force_authenticate(self.provider_user)
        resposta = self.client.post(self.list_url, self.proposal_payload())
        id_proposta = resposta.data["id"]
        self.client.force_authenticate(self.client_user)

        reject_response = self.client.post(
            reverse("proposal-reject", args=(id_proposta,))
        )

        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reject_response.data["status"], Proposal.Status.REJECTED)

    def test__apenas_pedido_proprietario_pode_aceitar_proposta_and_acceptance_cria_contratacao(self):
        self.client.force_authenticate(self.provider_user)
        accepted = self.client.post(
            self.list_url,
            self.proposal_payload(),
        )
        other_proposal = self.client.post(
            self.list_url,
            self.proposal_payload(
                order_id=self.create_order(title="Segundo pedido").pk,
            ),
        )
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("proposal-accept", args=(accepted.data["id"],))
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["final_price"], "18000.00")
        self.assertEqual(resposta.data["status"], "SCHEDULED")
        self.assertEqual(resposta.data["duration_minutes"], 60)
        self.assertIsNone(resposta.data["scheduled_at"])
        self.assertEqual(Proposal.objects.get(pk=accepted.data["id"]).status, "ACCEPTED")
        self.assertEqual(
            Proposal.objects.get(pk=other_proposal.data["id"]).status,
            Proposal.Status.PENDING,
        )

    def test__accepting_one_proposta_rejeita_other_propostas_para_same_pedido(self):
        self.client.force_authenticate(self.provider_user)
        primeiro = self.client.post(self.list_url, self.proposal_payload())
        self.client.force_authenticate(self.other_provider_user)
        second = self.client.post(
            self.list_url,
            self.proposal_payload(),
        )
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("proposal-accept", args=(primeiro.data["id"],))
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Proposal.objects.get(pk=second.data["id"]).status,
            Proposal.Status.REJECTED,
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, ServiceOrder.Status.AWARDED)

    def test__nao_pode_aceitar_proposta_quando_duration_esta_unknown(self):
        pedido = self.create_order(
            title="Pedido sem duração",
            requested_duration_minutes=None,
        )
        self.client.force_authenticate(self.provider_user)
        proposta = self.client.post(
            self.list_url,
            self.proposal_payload(order_id=pedido.pk),
        )
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("proposal-accept", args=(proposta.data["id"],))
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Booking.objects.filter(order=pedido).exists())
        pedido.refresh_from_db()
        self.assertEqual(pedido.status, ServiceOrder.Status.NEGOTIATING)

    def test__accepted_contratacao_usa_selected_servico_duration(self):
        servico = Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Reparação rápida",
            minimum_price=Decimal("18000.00"),
            maximum_price=Decimal("18000.00"),
            currency="AOA",
            price_type=Service.PriceType.FIXED,
            duration_minutes=45,
            is_active=True,
        )
        self.client.force_authenticate(self.provider_user)
        proposta = self.client.post(
            self.list_url,
            self.proposal_payload(service=servico.pk),
        )
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("proposal-accept", args=(proposta.data["id"],))
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["duration_minutes"], 45)

    def test__apenas_pedido_proprietario_pode_aceitar_proposta(self):
        self.client.force_authenticate(self.provider_user)
        resposta = self.client.post(self.list_url, self.proposal_payload())
        outsider = User.objects.create_user(
            "outsider@example.com",
            "Strong-Password-101!",
        )
        self.client.force_authenticate(outsider)

        accept_response = self.client.post(
            reverse("proposal-accept", args=(resposta.data["id"],))
        )

        self.assertEqual(accept_response.status_code, status.HTTP_403_FORBIDDEN)
