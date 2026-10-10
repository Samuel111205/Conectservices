from datetime import date, timedelta
from io import BytesIO
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.profiles.models import Profile

User = get_user_model()


def criar_imagem_carregada(*, image_format="PNG", name="profile.png", color="red"):
    image = Image.new("RGB", (8, 8), color=color)
    content = BytesIO()
    image.save(content, format=image_format)
    return SimpleUploadedFile(
        name,
        content.getvalue(),
        content_type=f"image/{image_format.lower()}",
    )


class ProfileApiTests(APITestCase):
    def setUp(self):
        self.media_directory = TemporaryDirectory()
        self.media_override = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.media_override.enable()
        self.user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-123!",
        )
        self.other_user = User.objects.create_user(
            "other@example.com",
            "Strong-Password-456!",
        )

    def tearDown(self):
        for perfil in Profile.objects.all():
            if perfil.photo:
                perfil.photo.delete(save=False)
        self.media_override.disable()
        self.media_directory.cleanup()

    def test__perfil_creation_exige_authentication(self):
        resposta = self.client.post(
            reverse("profile-create"),
            {"full_name": "Utilizador Teste"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__utilizador_pode_criar_and_read_proprio_perfil(self):
        self.client.force_authenticate(self.user)
        create_response = self.client.post(
            reverse("profile-create"),
            {
                "full_name": "Utilizador Teste",
                "biography": "Perfil pessoal.",
                "birth_date": "1990-01-01",
            },
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("user", create_response.data)
        self.assertNotIn("user_id", create_response.data)

        read_response = self.client.get(reverse("profile-me"))
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(read_response.data["full_name"], "Utilizador Teste")

    def test__utilizador_nao_pode_criar_perfil_para_outro_account(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            reverse("profile-create"),
            {
                "full_name": "Perfil indevido",
                "user": self.other_user.pk,
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Profile.objects.filter(user=self.other_user).exists())

    def test__duplicado_perfil_devolve_conflict(self):
        Profile.objects.create(user=self.user, full_name="Perfil existente")
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("profile-create"),
            {"full_name": "Segundo perfil"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Profile.objects.filter(user=self.user).count(), 1)

    def test__utilizador_pode_patch_proprio_perfil_but_nao_outro_utilizadores_perfil(self):
        perfil = Profile.objects.create(user=self.user, full_name="Original")
        other_profile = Profile.objects.create(
            user=self.other_user,
            full_name="Outro",
        )
        self.client.force_authenticate(self.user)

        update_response = self.client.patch(
            reverse("profile-me"),
            {"full_name": "Atualizado"},
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        perfil.refresh_from_db()
        self.assertEqual(perfil.full_name, "Atualizado")

        other_response = self.client.patch(
            reverse("profile-me"),
            {"full_name": "Alteração indevida", "id": other_profile.pk},
        )
        self.assertEqual(other_response.status_code, status.HTTP_200_OK)
        other_profile.refresh_from_db()
        self.assertEqual(other_profile.full_name, "Outro")

    def test__utilizador_nao_pode_alterar_perfil_proprietario(self):
        Profile.objects.create(user=self.user, full_name="Original")
        self.client.force_authenticate(self.user)

        resposta = self.client.patch(
            reverse("profile-me"),
            {"user_id": self.other_user.pk},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__perfil_rejeita_future_birth_date(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            reverse("profile-create"),
            {
                "full_name": "Utilizador Teste",
                "birth_date": (date.today() + timedelta(days=1)).isoformat(),
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__perfil_photo_deve_ser_a_supported_image(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            reverse("profile-create"),
            {
                "full_name": "Utilizador Teste",
                "photo": SimpleUploadedFile(
                    "malware.png",
                    b"not an image",
                    content_type="image/png",
                ),
            },
            format="multipart",
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Profile.objects.filter(user=self.user).exists())

    def test__perfil_photo_size_esta_limited(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            reverse("profile-create"),
            {
                "full_name": "Utilizador Teste",
                "photo": SimpleUploadedFile(
                    "large.png",
                    b"x" * (5 * 1024 * 1024 + 1),
                    content_type="image/png",
                ),
            },
            format="multipart",
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Profile.objects.filter(user=self.user).exists())

    def test__perfil_photo_esta_saved_com_generated_name(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            reverse("profile-create"),
            {
                "full_name": "Utilizador Teste",
                "photo": criar_imagem_carregada(name="../../unsafe.png"),
            },
            format="multipart",
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        perfil = Profile.objects.get(user=self.user)
        self.assertRegex(perfil.photo.name, r"^profiles/[0-9a-f]{32}\.png$")
