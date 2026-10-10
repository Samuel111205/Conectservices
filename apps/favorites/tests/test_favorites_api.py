from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Service
from apps.favorites.models import FavoriteProvider, FavoriteService
from apps.providers.models import Provider

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class FavoriteApiTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Tecnologia")
        self.user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-123!",
        )
        self.other_user = User.objects.create_user(
            "other@example.com",
            "Strong-Password-456!",
        )
        self.provider_user = User.objects.create_user(
            "provider@example.com",
            "Strong-Password-789!",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            commercial_name="Assistência Luanda",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )
        self.service = Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Reparação de computadores",
            description="Assistência técnica.",
            minimum_price="10000.00",
            maximum_price="10000.00",
            currency="AOA",
            price_type=Service.PriceType.FIXED,
            is_active=True,
        )
        self.provider_url = reverse("favorite-provider-list")
        self.service_url = reverse("favorite-service-list")

    def test__favoritos_exige_authentication(self):
        provider_response = self.client.get(self.provider_url)
        service_response = self.client.get(self.service_url)

        self.assertEqual(provider_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(service_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__utilizador_pode_favorito_and_unfavorite_prestador(self):
        self.client.force_authenticate(self.user)
        criado = self.client.post(
            self.provider_url,
            {"provider": self.provider.pk},
        )
        duplicate = self.client.post(
            self.provider_url,
            {"provider": self.provider.pk},
        )
        listed = self.client.get(self.provider_url)
        deleted = self.client.delete(
            reverse("favorite-provider-detail", args=(criado.data["id"],))
        )

        self.assertEqual(criado.status_code, status.HTTP_201_CREATED)
        self.assertEqual(criado.data["commercial_name"], self.provider.commercial_name)
        self.assertEqual(duplicate.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(FavoriteProvider.objects.exists())

    def test__utilizador_pode_favorito_servico_and_see_public_details(self):
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            self.service_url,
            {"service": self.service.pk},
        )
        listed = self.client.get(self.service_url)

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["service_name"], self.service.name)
        self.assertEqual(resposta.data["provider_name"], self.provider.commercial_name)
        self.assertEqual(resposta.data["minimum_price"], "10000.00")
        self.assertEqual(listed.data["count"], 1)

    def test__favoritos_estao_private_and_other_utilizadores_nao_pode_eliminar(self):
        favorite = FavoriteProvider.objects.create(
            user=self.user,
            provider=self.provider,
        )
        self.client.force_authenticate(self.other_user)

        listed = self.client.get(self.provider_url)
        deleted = self.client.delete(
            reverse("favorite-provider-detail", args=(favorite.pk,))
        )

        self.assertEqual(listed.data["count"], 0)
        self.assertEqual(deleted.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(FavoriteProvider.objects.filter(pk=favorite.pk).exists())

    def test__unavailable_targets_and_proprio_prestador_nao_pode_ser_favorited(self):
        self.client.force_authenticate(self.user)
        self.provider.verification_status = Provider.VerificationStatus.SUSPENDED
        self.provider.save(update_fields=("verification_status",))

        unavailable = self.client.post(
            self.provider_url,
            {"provider": self.provider.pk},
        )
        self.assertEqual(unavailable.status_code, status.HTTP_400_BAD_REQUEST)

        self.provider.verification_status = Provider.VerificationStatus.VERIFIED
        self.provider.save(update_fields=("verification_status",))
        self.service.is_active = False
        self.service.save(update_fields=("is_active", "updated_at"))
        unavailable_service = self.client.post(
            self.service_url,
            {"service": self.service.pk},
        )
        self.assertEqual(unavailable_service.status_code, status.HTTP_400_BAD_REQUEST)

        self.service.is_active = True
        self.service.save(update_fields=("is_active", "updated_at"))
        self.client.force_authenticate(self.provider_user)
        own_provider = self.client.post(
            self.provider_url,
            {"provider": self.provider.pk},
        )
        own_service = self.client.post(
            self.service_url,
            {"service": self.service.pk},
        )
        self.assertEqual(own_provider.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(own_service.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(FavoriteProvider.objects.exists())
        self.assertFalse(FavoriteService.objects.exists())

    def test__utilizadores_nao_pode_assign_favorito_proprietario_ou_other_target_campos(self):
        self.client.force_authenticate(self.user)

        provider_response = self.client.post(
            self.provider_url,
            {"provider": self.provider.pk, "user_id": self.other_user.pk},
        )
        service_response = self.client.post(
            self.service_url,
            {"service": self.service.pk, "owner_id": self.other_user.pk},
        )

        self.assertEqual(provider_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(service_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(FavoriteProvider.objects.exists())
        self.assertFalse(FavoriteService.objects.exists())
