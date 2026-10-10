from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.locations.models import (
    LocationAuditEvent,
    Municipality,
    Province,
    ProviderCoverage,
    UserLocation,
)
from apps.providers.models import Provider

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class LocationApiTests(APITestCase):
    def setUp(self):
        self.province = Province.objects.create(name="Luanda", code="LUA")
        self.other_province = Province.objects.create(
            name="Benguela",
            code="BGU",
        )
        self.municipality = Municipality.objects.create(
            province=self.province,
            name="Talatona",
        )
        self.other_municipality = Municipality.objects.create(
            province=self.other_province,
            name="Lobito",
        )
        self.user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-123!",
        )
        self.other_user = User.objects.create_user(
            "other@example.com",
            "Strong-Password-456!",
        )
        self.admin = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-789!",
        )

    def test__active_provinces_and_municipalities_estao_public(self):
        resposta = self.client.get(reverse("province-list"))
        municipalities = self.client.get(
            reverse("municipality-list"),
            {"province": self.province.pk},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(municipalities.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [elemento["name"] for elemento in municipalities.data["results"]],
            ["Talatona"],
        )

    def test__non_administrador_nao_pode_modify_geography_catalogue(self):
        self.client.force_authenticate(self.user)

        province_response = self.client.post(
            reverse("province-list"),
            {"name": "Huambo", "code": "HUA"},
        )
        municipality_response = self.client.post(
            reverse("municipality-list"),
            {"province": self.province.pk, "name": "Kilamba"},
        )

        self.assertEqual(
            province_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            municipality_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test__administrador_pode_criar_municipio_and_audit_it(self):
        self.client.force_authenticate(self.admin)

        resposta = self.client.post(
            reverse("municipality-list"),
            {"province": self.province.pk, "name": "Kilamba"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        municipio = Municipality.objects.get(name="Kilamba")
        event = LocationAuditEvent.objects.get(
            entity_id_snapshot=municipio.pk,
        )
        self.assertEqual(
            event.entity_type,
            LocationAuditEvent.EntityType.MUNICIPALITY,
        )
        self.assertEqual(event.actor, self.admin)

    def test__administrador_nao_pode_deactivate_provincia_com_active_municipalities(self):
        self.client.force_authenticate(self.admin)

        resposta = self.client.delete(
            reverse("province-detail", args=(self.province.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.province.refresh_from_db()
        self.assertTrue(self.province.is_active)

    def test__administrador_deactivates_municipio_sem_erasing_history(self):
        self.client.force_authenticate(self.admin)

        resposta = self.client.delete(
            reverse("municipality-detail", args=(self.municipality.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.municipality.refresh_from_db()
        self.assertFalse(self.municipality.is_active)
        self.assertTrue(
            Municipality.objects.filter(pk=self.municipality.pk).exists()
        )

    def test__municipio_filter_rejeita_invalido_id(self):
        resposta = self.client.get(
            reverse("municipality-list"),
            {"province": "invalid"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__municipio_unique_name_esta_scoped_para_provincia(self):
        Municipality.objects.create(province=self.other_province, name="Talatona")
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Municipality.objects.create(
                    province=self.province,
                    name="Talatona",
                )

    def test__utilizador_locations_exige_authentication(self):
        resposta = self.client.get(reverse("user-location-list"))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test__utilizador_localizacao_esta_private_para_proprietario(self):
        location = UserLocation.objects.create(
            user=self.user,
            municipality=self.municipality,
            label="Casa",
            neighborhood="Talatona",
            address="Rua privada, 10",
        )
        self.client.force_authenticate(self.other_user)

        list_response = self.client.get(reverse("user-location-list"))
        detail_response = self.client.get(
            reverse("user-location-detail", args=(location.pk,))
        )

        self.assertEqual(list_response.data["count"], 0)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test__utilizador_pode_criar_localizacao_and_latitude_exige_longitude(self):
        self.client.force_authenticate(self.user)
        invalid_response = self.client.post(
            reverse("user-location-list"),
            {
                "municipality": self.municipality.pk,
                "label": "Casa",
                "latitude": "-8.9147",
            },
        )
        self.assertEqual(
            invalid_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        resposta = self.client.post(
            reverse("user-location-list"),
            {
                "municipality": self.municipality.pk,
                "label": "Casa",
                "neighborhood": "Talatona",
                "address": "Rua privada, 10",
                "latitude": "-8.9147000",
                "longitude": "13.1847000",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("user", resposta.data)
        self.assertEqual(resposta.data["province_name"], "Luanda")

    def test__localizacao_coordinate_ranges_estao_enforced(self):
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("user-location-list"),
            {
                "municipality": self.municipality.pk,
                "latitude": "91",
                "longitude": "181",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__utilizador_pode_apenas_atualizar_and_archive_proprio_localizacao(self):
        location = UserLocation.objects.create(
            user=self.user,
            municipality=self.municipality,
            label="Casa",
        )
        self.client.force_authenticate(self.other_user)

        update_response = self.client.patch(
            reverse("user-location-detail", args=(location.pk,)),
            {"label": "Alteração"},
        )
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(self.user)
        delete_response = self.client.delete(
            reverse("user-location-detail", args=(location.pk,))
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        location.refresh_from_db()
        self.assertFalse(location.is_active)

    def test__inactive_municipio_nao_pode_ser_selected_para_new_localizacao(self):
        self.municipality.is_active = False
        self.municipality.save(update_fields=("is_active", "updated_at"))
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            reverse("user-location-list"),
            {"municipality": self.municipality.pk, "label": "Casa"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__localizacao_constraints_exige_both_coordinates(self):
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                UserLocation.objects.create(
                    user=self.user,
                    municipality=self.municipality,
                    latitude=Decimal("-8.9000000"),
                )


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ProviderCoverageApiTests(APITestCase):
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
        self.list_url = reverse("provider-coverage-list")

    def test__pendente_prestador_pode_save_coverage_but_esta_nao_public(self):
        self.client.force_authenticate(self.user)
        resposta = self.client.post(
            self.list_url,
            {
                "municipality": self.municipality.pk,
                "radius_km": "10.00",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProviderCoverage.objects.count(), 1)
        self.assertEqual(self.client.get(self.list_url).data["count"], 0)

    def test__public_coverage_esta_filtered_para_verificado_active_prestadores(self):
        self.provider.mark_verified()
        self.other_provider.mark_verified()
        public_coverage = ProviderCoverage.objects.create(
            provider=self.provider,
            municipality=self.municipality,
        )
        ProviderCoverage.objects.create(
            provider=self.other_provider,
            municipality=self.other_municipality,
        )
        self.other_user.is_active = False
        self.other_user.save(update_fields=("is_active",))

        resposta = self.client.get(
            self.list_url,
            {"municipality": self.municipality.pk},
        )

        self.assertEqual(resposta.data["count"], 1)
        self.assertEqual(resposta.data["results"][0]["id"], public_coverage.pk)
        self.assertEqual(
            resposta.data["results"][0]["provider_name"],
            "Serviços Luanda",
        )
        self.assertNotIn("provider_email", resposta.data["results"][0])

    def test__prestador_pode_listar_apenas_proprio_coverage(self):
        own = ProviderCoverage.objects.create(
            provider=self.provider,
            municipality=self.municipality,
        )
        ProviderCoverage.objects.create(
            provider=self.other_provider,
            municipality=self.other_municipality,
        )
        self.client.force_authenticate(self.user)

        resposta = self.client.get(reverse("provider-coverage-mine"))

        self.assertEqual(resposta.data["count"], 1)
        self.assertEqual(resposta.data["results"][0]["id"], own.pk)

    def test__prestador_nao_pode_alterar_outro_prestadores_coverage(self):
        coverage = ProviderCoverage.objects.create(
            provider=self.other_provider,
            municipality=self.municipality,
        )
        self.client.force_authenticate(self.user)

        resposta = self.client.patch(
            reverse("provider-coverage-detail", args=(coverage.pk,)),
            {"municipality": self.other_municipality.pk},
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        coverage.refresh_from_db()
        self.assertEqual(coverage.municipality, self.municipality)

    def test__prestador_coverage_esta_unique_per_municipio(self):
        self.client.force_authenticate(self.user)
        self.client.post(
            self.list_url,
            {"municipality": self.municipality.pk},
        )

        duplicate = self.client.post(
            self.list_url,
            {"municipality": self.municipality.pk},
        )

        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ProviderCoverage.objects.count(), 1)

    def test__prestador_nao_pode_assign_coverage_proprietario_directly(self):
        self.client.force_authenticate(self.user)

        resposta = self.client.post(
            self.list_url,
            {
                "municipality": self.municipality.pk,
                "provider_id": self.other_provider.pk,
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ProviderCoverage.objects.exists())

    def test__prestador_sem_perfil_nao_pode_manage_coverage(self):
        client_user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-789!",
        )
        self.client.force_authenticate(client_user)

        resposta = self.client.post(
            self.list_url,
            {"municipality": self.municipality.pk},
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
