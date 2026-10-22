from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.businesses.models import BusinessProfile
from apps.catalog.models import Category, Service
from apps.providers.models import Provider

User = get_user_model()


class BusinessProfileApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "empresa@example.com",
            "Strong-Password-123!",
        )
        self.other_user = User.objects.create_user(
            "outra@example.com",
            "Strong-Password-456!",
        )
        self.payload = {
            "commercial_name": "Conect Limpezas",
            "description": "Serviços profissionais de limpeza.",
            "business_phone": "+244923111111",
            "business_email": "contacto@conect.example",
            "registered_name": "Conect Limpezas, Lda.",
            "website": "https://conect.example",
            "address": "Luanda",
            "opening_hours": {"monday": "08:00-17:00", "sunday": "Fechado"},
        }

    def test__criar_perfil_empresarial_exige_autenticacao(self):
        resposta = self.client.post(
            reverse("business-profile-create"), self.payload, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(BusinessProfile.objects.exists())

    def test__empresa_cria_prestador_e_perfil_empresarial(self):
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("business-profile-create"), self.payload, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        provider = Provider.objects.get(user=self.user)
        profile = BusinessProfile.objects.get(provider=provider)
        self.assertEqual(profile.registered_name, "Conect Limpezas, Lda.")
        self.assertEqual(provider.commercial_name, "Conect Limpezas")
        self.assertEqual(
            provider.verification_status,
            Provider.VerificationStatus.PENDING,
        )
        self.assertEqual(resposta.data["opening_hours"]["monday"], "08:00-17:00")
        self.assertNotIn("user", resposta.data)
        self.assertNotIn("provider", resposta.data)

    def test__prestador_existente_pode_completar_perfil_empresarial(self):
        provider = Provider.objects.create(
            user=self.user,
            commercial_name="Nome anterior",
        )
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("business-profile-create"), self.payload, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Provider.objects.filter(user=self.user).count(), 1)
        provider.refresh_from_db()
        self.assertEqual(provider.commercial_name, "Conect Limpezas")
        self.assertTrue(BusinessProfile.objects.filter(provider=provider).exists())

    def test__conta_nao_pode_criar_dois_perfis_empresariais(self):
        provider = Provider.objects.create(
            user=self.user,
            commercial_name="Conect Limpezas",
        )
        BusinessProfile.objects.create(provider=provider)
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("business-profile-create"), self.payload, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(BusinessProfile.objects.filter(provider=provider).count(), 1)

    def test__empresa_actualiza_apenas_o_proprio_perfil(self):
        provider = Provider.objects.create(
            user=self.user,
            commercial_name="Conect Limpezas",
        )
        BusinessProfile.objects.create(provider=provider)
        other_provider = Provider.objects.create(
            user=self.other_user,
            commercial_name="Outra empresa",
        )
        BusinessProfile.objects.create(provider=other_provider)
        self.client.force_authenticate(self.user)

        consulta = self.client.get(reverse("business-profile-me"))
        actualizacao = self.client.patch(
            reverse("business-profile-me"),
            {
                "commercial_name": "Conect Limpezas Actualizada",
                "website": "https://novo.example",
            },
        )

        self.assertEqual(consulta.status_code, status.HTTP_200_OK)
        self.assertEqual(actualizacao.status_code, status.HTTP_200_OK)
        provider.refresh_from_db()
        other_provider.refresh_from_db()
        self.assertEqual(provider.commercial_name, "Conect Limpezas Actualizada")
        self.assertEqual(other_provider.commercial_name, "Outra empresa")
        self.assertEqual(actualizacao.data["website"], "https://novo.example")

    def test__estado_de_verificacao_nao_pode_ser_alterado_pela_empresa(self):
        provider = Provider.objects.create(
            user=self.user,
            commercial_name="Conect Limpezas",
        )
        BusinessProfile.objects.create(provider=provider)
        self.client.force_authenticate(self.user)

        resposta = self.client.patch(
            reverse("business-profile-me"),
            {"verification_status": Provider.VerificationStatus.VERIFIED},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        provider.refresh_from_db()
        self.assertEqual(
            provider.verification_status,
            Provider.VerificationStatus.PENDING,
        )

    def test__horario_com_dias_invalidos_e_rejeitado(self):
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("business-profile-create"),
            {**self.payload, "opening_hours": {"fundays": "sempre"}},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(BusinessProfile.objects.exists())

    def test__discovery_expoe_dados_publicos_somente_de_empresa_verificada(self):
        category = Category.objects.create(name="Limpeza")
        provider = Provider.objects.create(
            user=self.user,
            commercial_name="Conect Limpezas",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )
        profile = BusinessProfile.objects.create(
            provider=provider,
            registered_name="Conect Limpezas, Lda.",
            website="https://conect.example",
            address="Morada privada",
            opening_hours={"monday": "08:00-17:00"},
        )
        Service.objects.create(
            provider=provider,
            category=category,
            name="Limpeza doméstica",
            price_type=Service.PriceType.ON_REQUEST,
            is_active=True,
        )

        resposta = self.client.get(reverse("provider-discover"))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        public_business = resposta.data["results"][0]["business_profile"]
        self.assertEqual(public_business["website"], profile.website)
        self.assertEqual(public_business["opening_hours"]["monday"], "08:00-17:00")
        self.assertNotIn("address", public_business)
        self.assertNotIn("registered_name", public_business)
