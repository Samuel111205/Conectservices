from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.providers.models import Provider

User = get_user_model()


class ProviderApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "provider@example.com",
            "Strong-Password-123!",
        )
        self.other_user = User.objects.create_user(
            "other@example.com",
            "Strong-Password-456!",
        )

    def test__prestador_creation_exige_authentication(self):
        resposta = self.client.post(
            reverse("provider-create"),
            {"commercial_name": "Serviços Luanda"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__utilizador_pode_criar_prestador_and_estado_inicia_pendente(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            reverse("provider-create"),
            {
                "commercial_name": "Serviços Luanda",
                "description": "Assistência técnica.",
                "business_phone": "+244923111111",
                "business_email": "contact@example.com",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        prestador = Provider.objects.get(user=self.user)
        self.assertEqual(
            prestador.verification_status,
            Provider.VerificationStatus.PENDING,
        )
        self.assertIsNone(prestador.verified_at)
        self.assertNotIn("user", resposta.data)
        self.assertNotIn("user_id", resposta.data)

    def test__utilizador_nao_pode_criar_ou_verificar_outro_utilizadores_prestador(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            reverse("provider-create"),
            {
                "commercial_name": "Prestador falso",
                "user": self.other_user.pk,
                "verification_status": Provider.VerificationStatus.VERIFIED,
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Provider.objects.filter(user=self.other_user).exists())
        self.assertFalse(Provider.objects.filter(user=self.user).exists())

    def test__prestador_estado_nao_pode_ser_alterado_na_conta_rota(self):
        prestador = Provider.objects.create(
            user=self.user,
            commercial_name="Serviços Luanda",
        )
        self.client.force_authenticate(self.user)

        resposta = self.client.patch(
            reverse("provider-me"),
            {
                "commercial_name": "Serviços atualizados",
                "verification_status": Provider.VerificationStatus.VERIFIED,
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        prestador.refresh_from_db()
        self.assertEqual(
            prestador.verification_status,
            Provider.VerificationStatus.PENDING,
        )
        self.assertEqual(prestador.commercial_name, "Serviços Luanda")

    def test__prestador_pode_atualizar_proprio_business_details(self):
        prestador = Provider.objects.create(
            user=self.user,
            commercial_name="Nome original",
        )
        self.client.force_authenticate(self.user)

        resposta = self.client.patch(
            reverse("provider-me"),
            {"commercial_name": "Nome atualizado"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        prestador.refresh_from_db()
        self.assertEqual(prestador.commercial_name, "Nome atualizado")

    def test__utilizador_nao_pode_modify_outro_prestadores_record(self):
        prestador = Provider.objects.create(
            user=self.other_user,
            commercial_name="Registo privado",
        )
        self.client.force_authenticate(self.user)

        resposta = self.client.patch(
            reverse("provider-me"),
            {"commercial_name": "Alteração indevida", "id": prestador.pk},
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        prestador.refresh_from_db()
        self.assertEqual(prestador.commercial_name, "Registo privado")

    def test__duplicado_prestador_devolve_conflict(self):
        Provider.objects.create(user=self.user, commercial_name="Existente")
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("provider-create"),
            {"commercial_name": "Duplicado"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Provider.objects.filter(user=self.user).count(), 1)

    def test__apenas_administrador_pode_alterar_prestador_verificacao(self):
        prestador = Provider.objects.create(
            user=self.user,
            commercial_name="Serviços Luanda",
        )
        admin_user = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-789!",
        )
        self.client.force_login(admin_user)

        resposta = self.client.post(
            f"/admin/providers/provider/{prestador.pk}/change/",
            {
                "user": prestador.user.pk,
                "commercial_name": prestador.commercial_name,
                "description": prestador.description,
                "business_phone": prestador.business_phone,
                "business_email": prestador.business_email,
                "verification_status": Provider.VerificationStatus.VERIFIED,
                "verified_at_0": "",
                "verified_at_1": "",
                "_save": "Guardar",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_302_FOUND)
        prestador.refresh_from_db()
        self.assertEqual(
            prestador.verification_status,
            Provider.VerificationStatus.VERIFIED,
        )
        self.assertIsNotNone(prestador.verified_at)

    def test__administrador_verificacao_define_timestamp_em_creation(self):
        admin_user = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-789!",
        )
        self.client.force_login(admin_user)

        resposta = self.client.post(
            "/admin/providers/provider/add/",
            {
                "user": self.user.pk,
                "commercial_name": "Prestador verificado",
                "description": "",
                "business_phone": "",
                "business_email": "",
                "verification_status": Provider.VerificationStatus.VERIFIED,
                "verified_at_0": "",
                "verified_at_1": "",
                "_save": "Guardar",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_302_FOUND)
        prestador = Provider.objects.get(user=self.user)
        self.assertEqual(
            prestador.verification_status,
            Provider.VerificationStatus.VERIFIED,
        )
        self.assertIsNotNone(prestador.verified_at)
