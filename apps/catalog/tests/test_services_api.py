from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Service
from apps.providers.models import Provider

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ServiceApiTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Tecnologia")
        self.user = User.objects.create_user(
            "provider@example.com",
            "Strong-Password-123!",
        )
        self.other_user = User.objects.create_user(
            "other@example.com",
            "Strong-Password-456!",
        )
        self.provider = Provider.objects.create(
            user=self.user,
            commercial_name="Serviços Luanda",
        )
        self.other_provider = Provider.objects.create(
            user=self.other_user,
            commercial_name="Outro prestador",
        )
        self.list_url = reverse("service-list")

    def service_payload(self, **overrides):
        return {
            "category": self.category.pk,
            "name": "Reparação de computadores",
            "description": "Assistência informática.",
            "minimum_price": "15000.00",
            "maximum_price": "25000.00",
            "currency": "AOA",
            "price_type": Service.PriceType.RANGE,
            "duration_minutes": 90,
            "is_active": False,
            **overrides,
        }

    def create_service(self, *, provider=None, is_active=True, **overrides):
        provider = provider or self.provider
        return Service.objects.create(
            provider=provider,
            category=self.category,
            name=overrides.get("name", "Reparação de computadores"),
            description="Assistência informática.",
            minimum_price=Decimal("15000.00"),
            maximum_price=Decimal("25000.00"),
            currency="AOA",
            price_type=Service.PriceType.RANGE,
            duration_minutes=90,
            is_active=is_active,
            **{
                key: valor
                for key, valor in overrides.items()
                if key != "name"
            },
        )

    def test__servico_creation_exige_authentication(self):
        resposta = self.client.post(self.list_url, self.service_payload())

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__servico_duration_nao_pode_exceed_one_day(self):
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            self.list_url,
            self.service_payload(duration_minutes=1441),
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Service.objects.exists())

    def test__utilizador_sem_prestador_nao_pode_criar_servico(self):
        client_user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-789!",
        )
        self.client.force_authenticate(client_user)

        resposta = self.client.post(self.list_url, self.service_payload())

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test__pendente_prestador_pode_criar_draft_but_nao_pode_publish(self):
        self.client.force_authenticate(self.user)

        create_response = self.client.post(
            self.list_url,
            self.service_payload(),
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        servico = Service.objects.get(provider=self.provider)
        self.assertFalse(servico.is_active)

        publish_response = self.client.patch(
            reverse("service-detail", args=(servico.pk,)),
            {"is_active": True},
        )
        self.assertEqual(
            publish_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        servico.refresh_from_db()
        self.assertFalse(servico.is_active)

    def test__verificado_prestador_pode_publish_servico(self):
        self.provider.mark_verified()
        self.client.force_authenticate(self.user)
        create_response = self.client.post(
            self.list_url,
            self.service_payload(),
        )
        servico = Service.objects.get(pk=create_response.data["id"])

        resposta = self.client.patch(
            reverse("service-detail", args=(servico.pk,)),
            {"is_active": True},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        servico.refresh_from_db()
        self.assertTrue(servico.is_active)

    def test__nao_pode_criar_servico_para_outro_prestador(self):
        self.provider.mark_verified()
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            self.list_url,
            self.service_payload(
                provider=self.other_provider.pk,
                is_active=True,
            ),
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Service.objects.exists())

    def test__price_type_exige_matching_price_valores(self):
        self.client.force_authenticate(self.user)
        cases = (
            {
                "price_type": Service.PriceType.FIXED,
                "minimum_price": "10000.00",
                "maximum_price": "12000.00",
            },
            {
                "price_type": Service.PriceType.STARTING_AT,
                "minimum_price": None,
                "maximum_price": None,
            },
            {
                "price_type": Service.PriceType.RANGE,
                "minimum_price": "25000.00",
                "maximum_price": "15000.00",
            },
            {
                "price_type": Service.PriceType.ON_REQUEST,
                "minimum_price": "10000.00",
                "maximum_price": "10000.00",
            },
        )

        for values in cases:
            with self.subTest(values=values):
                resposta = self.client.post(
                    self.list_url,
                    self.service_payload(**values),
                    format="json",
                )
                self.assertEqual(
                    resposta.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
        self.assertFalse(Service.objects.exists())

    def test__servico_price_database_constraint_rejeita_invalido_range(self):
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Service.objects.create(
                    provider=self.provider,
                    category=self.category,
                    name="Preço inválido",
                    minimum_price=Decimal("25000.00"),
                    maximum_price=Decimal("15000.00"),
                    currency="AOA",
                    price_type=Service.PriceType.RANGE,
                )

    def test__public_search_devolve_apenas_active_servicos_of_verificado_prestadores(self):
        self.provider.mark_verified()
        public_service = self.create_service(name="Reparação pública")
        self.create_service(
            provider=self.other_provider,
            name="Prestador pendente",
        )
        inactive_service = self.create_service(
            name="Rascunho privado",
            is_active=False,
        )

        resposta = self.client.get(self.list_url, {"search": "Reparação"})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        result_ids = [elemento["id"] for elemento in resposta.data["results"]]
        self.assertEqual(result_ids, [public_service.pk])
        self.assertNotIn(inactive_service.pk, result_ids)

    def test__servico_filter_rejeita_invalido_categoria(self):
        resposta = self.client.get(self.list_url, {"category": "invalid"})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__prestador_pode_listar_and_edit_apenas_proprio_servicos(self):
        own_service = self.create_service(is_active=False)
        other_service = self.create_service(
            provider=self.other_provider,
            is_active=False,
            name="Serviço alheio",
        )
        self.client.force_authenticate(self.user)

        mine_response = self.client.get(reverse("service-mine"))
        self.assertEqual(mine_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [elemento["id"] for elemento in mine_response.data["results"]],
            [own_service.pk],
        )

        update_response = self.client.patch(
            reverse("service-detail", args=(other_service.pk,)),
            {"name": "Tentativa indevida"},
        )
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)
        other_service.refresh_from_db()
        self.assertEqual(other_service.name, "Serviço alheio")

    def test__eliminar_deactivates_servico_instead_of_erasing_history(self):
        self.provider.mark_verified()
        servico = self.create_service(is_active=True)
        self.client.force_authenticate(self.user)

        resposta = self.client.delete(
            reverse("service-detail", args=(servico.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        servico.refresh_from_db()
        self.assertFalse(servico.is_active)
        self.assertTrue(Service.objects.filter(pk=servico.pk).exists())

    def test__inactive_categoria_nao_pode_ser_used_para_publish_servico(self):
        self.provider.mark_verified()
        self.category.is_active = False
        self.category.save(update_fields=("is_active", "updated_at"))
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            self.list_url,
            self.service_payload(is_active=True),
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Service.objects.exists())
