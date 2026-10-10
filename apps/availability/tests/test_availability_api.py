from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.availability.models import WeeklyAvailability
from apps.providers.models import Provider

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class WeeklyAvailabilityApiTests(APITestCase):
    def setUp(self):
        self.provider_user = User.objects.create_user(
            "provider@example.com",
            "Strong-Password-123!",
        )
        self.other_user = User.objects.create_user(
            "other@example.com",
            "Strong-Password-456!",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            commercial_name="Serviços Luanda",
        )
        self.list_url = reverse("availability-list")

    def payload(self, **overrides):
        return {
            "weekday": WeeklyAvailability.Weekday.MONDAY,
            "start_time": "09:00",
            "end_time": "12:00",
            **overrides,
        }

    def test__disponibilidade_exige_authentication_and_prestador_perfil(self):
        anonymous = self.client.post(self.list_url, self.payload())
        self.client.force_authenticate(self.other_user)
        no_provider = self.client.post(self.list_url, self.payload())

        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(no_provider.status_code, status.HTTP_403_FORBIDDEN)

    def test__prestador_pode_manage_apenas_proprio_weekly_windows(self):
        self.client.force_authenticate(self.provider_user)
        criado = self.client.post(self.list_url, self.payload())
        listed = self.client.get(self.list_url)
        other_provider = Provider.objects.create(
            user=self.other_user,
            commercial_name="Outro prestador",
        )
        foreign = WeeklyAvailability.objects.create(
            provider=other_provider,
            weekday=WeeklyAvailability.Weekday.TUESDAY,
            start_time="13:00",
            end_time="15:00",
        )
        foreign_detail = self.client.patch(
            reverse("availability-detail", args=(foreign.pk,)),
            {"end_time": "16:00"},
        )
        deleted = self.client.delete(
            reverse("availability-detail", args=(criado.data["id"],))
        )

        self.assertEqual(criado.status_code, status.HTTP_201_CREATED)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(foreign_detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            WeeklyAvailability.objects.filter(provider=self.provider).exists()
        )

    def test__overlapping_windows_and_invalido_range_estao_rejected(self):
        self.client.force_authenticate(self.provider_user)
        primeiro = self.client.post(self.list_url, self.payload())
        overlap = self.client.post(
            self.list_url,
            self.payload(start_time="11:00", end_time="14:00"),
        )
        invalid = self.client.post(
            self.list_url,
            self.payload(start_time="15:00", end_time="14:00"),
        )

        self.assertEqual(primeiro.status_code, status.HTTP_201_CREATED)
        self.assertEqual(overlap.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WeeklyAvailability.objects.count(), 1)

    def test__adjacent_windows_estao_allowed_and_partial_atualizar_checks_overlap(self):
        self.client.force_authenticate(self.provider_user)
        primeiro = self.client.post(self.list_url, self.payload())
        second = self.client.post(
            self.list_url,
            self.payload(start_time="12:00", end_time="14:00"),
        )
        update = self.client.patch(
            reverse("availability-detail", args=(second.data["id"],)),
            {"start_time": "11:30"},
        )

        self.assertEqual(primeiro.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(update.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WeeklyAvailability.objects.count(), 2)
