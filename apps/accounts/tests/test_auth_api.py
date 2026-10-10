from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class UserManagerTests(APITestCase):
    def test__criar_utilizador_normaliza_correio_eletronico_and_gera_hash_palavra_passe(self):
        utilizador = User.objects.create_user("  CLIENT@Example.COM ", "Long-Pass-789!")

        self.assertEqual(utilizador.email, "client@example.com")
        self.assertNotEqual(utilizador.password, "Long-Pass-789!")
        self.assertTrue(utilizador.check_password("Long-Pass-789!"))
        self.assertFalse(utilizador.is_staff)


class AuthenticationApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.password = "A-Strong-Password-789!"
        self.user = User.objects.create_user(
            "client@example.com",
            self.password,
            phone="+244923000000",
        )

    def test__registo_cria_utilizador_sem_returning_palavra_passe(self):
        resposta = self.client.post(
            reverse("auth-register"),
            {
                "email": " New.Client@Example.com ",
                "phone": "",
                "password": "Another-Strong-Password-789!",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_202_ACCEPTED)
        created_user = User.objects.get(email="new.client@example.com")
        self.assertTrue(
            created_user.check_password("Another-Strong-Password-789!")
        )
        self.assertNotIn("password", resposta.data)
        self.assertNotIn("email", resposta.data)

    def test__registo_resposta_nao_revelar_existente_correio_eletronico(self):
        payload = {
            "email": self.user.email,
            "password": "Another-Strong-Password-789!",
        }

        existing_response = self.client.post(reverse("auth-register"), payload)
        new_response = self.client.post(
            reverse("auth-register"),
            {**payload, "email": "not-yet-registered@example.com"},
        )

        self.assertEqual(existing_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(existing_response.status_code, new_response.status_code)
        self.assertEqual(existing_response.data, new_response.data)

    def test__registo_rejeita_fraca_palavra_passe(self):
        resposta = self.client.post(
            reverse("auth-register"),
            {"email": "new@example.com", "password": "123"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test__entrar_usa_correio_eletronico_and_devolve_jwt_pair(self):
        resposta = self.client.post(
            reverse("auth-token"),
            {"email": self.user.email, "password": self.password},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn("access", resposta.data)
        self.assertIn("refresh", resposta.data)

    def test__entrar_falha_nao_revelar_account_existence(self):
        known_email_response = self.client.post(
            reverse("auth-token"),
            {"email": self.user.email, "password": "incorrect-password"},
        )
        unknown_email_response = self.client.post(
            reverse("auth-token"),
            {"email": "unknown@example.com", "password": "incorrect-password"},
        )

        self.assertEqual(
            known_email_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            known_email_response.status_code,
            unknown_email_response.status_code,
        )
        self.assertEqual(known_email_response.data, unknown_email_response.data)

    def test__inactive_utilizador_nao_pode_log_em(self):
        self.user.is_active = False
        self.user.save(update_fields=("is_active",))

        resposta = self.client.post(
            reverse("auth-token"),
            {"email": self.user.email, "password": self.password},
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__entrar_esta_rate_limited(self):
        responses = [
            self.client.post(
                reverse("auth-token"),
                {"email": self.user.email, "password": "incorrect-password"},
            )
            for _ in range(6)
        ]

        self.assertTrue(
            all(
                resposta.status_code == status.HTTP_401_UNAUTHORIZED
                for resposta in responses[:5]
            )
        )
        self.assertEqual(
            responses[5].status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    def test__account_rota_exige_authentication(self):
        resposta = self.client.get(reverse("auth-me"))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__account_rota_apenas_atualiza_phone(self):
        self.client.force_authenticate(self.user)

        resposta = self.client.patch(
            reverse("auth-me"),
            {"phone": "+244923111111", "is_staff": True},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "+244923111111")
        self.assertFalse(self.user.is_staff)
        self.assertNotIn("is_staff", resposta.data)

    def test__sair_revokes_proprio_refresh_token(self):
        pair_response = self.client.post(
            reverse("auth-token"),
            {"email": self.user.email, "password": self.password},
        )
        self.assertEqual(pair_response.status_code, status.HTTP_200_OK)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {pair_response.data['access']}"
        )
        logout_response = self.client.post(
            reverse("auth-logout"),
            {"refresh": pair_response.data["refresh"]},
        )
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)

        refresh_response = self.client.post(
            reverse("auth-token-refresh"),
            {"refresh": pair_response.data["refresh"]},
        )
        self.assertEqual(
            refresh_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test__sair_rejeita_outro_utilizadores_refresh_token(self):
        other_user = User.objects.create_user(
            "other@example.com",
            "Another-Strong-Password-789!",
        )
        token_response = self.client.post(
            reverse("auth-token"),
            {"email": other_user.email, "password": "Another-Strong-Password-789!"},
        )
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("auth-logout"),
            {"refresh": token_response.data["refresh"]},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__administrador_pode_open_utilizador_creation_form(self):
        admin_user = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-789!",
        )
        self.client.force_login(admin_user)

        resposta = self.client.get("/admin/accounts/user/add/")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
