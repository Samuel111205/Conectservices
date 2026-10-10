from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category
from apps.bookings.models import Booking
from apps.availability.models import WeeklyAvailability
from apps.locations.models import Municipality, Province
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class BookingApiTests(APITestCase):
    def setUp(self):
        provincia = Province.objects.create(name="Luanda", code="LUA")
        municipio = Municipality.objects.create(
            province=provincia,
            name="Talatona",
        )
        categoria = Category.objects.create(name="Tecnologia")
        self.client_user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-123!",
        )
        self.provider_user = User.objects.create_user(
            "provider@example.com",
            "Strong-Password-456!",
        )
        self.outsider = User.objects.create_user(
            "outsider@example.com",
            "Strong-Password-789!",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            commercial_name="Assistência Luanda",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )
        self.order = ServiceOrder.objects.create(
            client=self.client_user,
            category=categoria,
            title="Reparar computador",
            description="Pedido.",
            municipality=municipio,
            municipality_name_snapshot=municipio.name,
            province_name_snapshot=provincia.name,
            status=ServiceOrder.Status.NEGOTIATING,
        )
        self.proposal = Proposal.objects.create(
            order=self.order,
            provider=self.provider,
            price="18000.00",
            currency="AOA",
            description="Proposta.",
            estimated_days=2,
        )
        local_day = timezone.localdate() + timedelta(days=3)
        self.slot_start = timezone.make_aware(
            datetime.combine(local_day, datetime.min.time()).replace(
                hour=9,
            ),
            ZoneInfo("Africa/Luanda"),
        )
        WeeklyAvailability.objects.create(
            provider=self.provider,
            weekday=local_day.weekday(),
            start_time="09:00",
            end_time="11:00",
        )
        self.booking = Booking.objects.create(
            order=self.order,
            proposal=self.proposal,
            client=self.client_user,
            provider=self.provider,
            final_price=self.proposal.price,
            duration_minutes=60,
            currency="AOA",
            scheduled_at=self.slot_start,
        )
        self.list_url = reverse("booking-list")

    def test__contratacao_listar_esta_visible_apenas_para_participants(self):
        self.client.force_authenticate(self.outsider)
        outsider_response = self.client.get(self.list_url)
        self.client.force_authenticate(self.client_user)
        client_response = self.client.get(self.list_url)
        self.client.force_authenticate(self.provider_user)
        provider_response = self.client.get(self.list_url)

        self.assertEqual(outsider_response.data["count"], 0)
        self.assertEqual(client_response.data["count"], 1)
        self.assertEqual(provider_response.data["count"], 1)
        self.assertTrue(client_response.data["results"][0]["is_client"])
        self.assertFalse(client_response.data["results"][0]["is_provider"])
        self.assertFalse(provider_response.data["results"][0]["is_client"])
        self.assertTrue(provider_response.data["results"][0]["is_provider"])

    def test__apenas_cliente_pode_confirm_scheduled_contratacao(self):
        self.client.force_authenticate(self.provider_user)
        proibido = self.client.post(
            reverse("booking-confirm", args=(self.booking.pk,))
        )
        self.client.force_authenticate(self.client_user)
        resposta = self.client.post(
            reverse("booking-confirm", args=(self.booking.pk,))
        )

        self.assertEqual(proibido.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)

    def test__apenas_cliente_pode_query_and_schedule_available_slots(self):
        self.client.force_authenticate(self.provider_user)
        forbidden_slots = self.client.get(
            reverse("booking-available-slots", args=(self.booking.pk,)),
            {"date": self.slot_start.date().isoformat()},
        )
        self.client.force_authenticate(self.client_user)
        slots = self.client.get(
            reverse("booking-available-slots", args=(self.booking.pk,)),
            {"date": self.slot_start.date().isoformat()},
        )
        schedule_url = reverse("booking-schedule", args=(self.booking.pk,))
        selected = self.client.post(
            schedule_url,
            {"scheduled_at": self.slot_start.isoformat()},
        )

        self.assertEqual(forbidden_slots.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(slots.status_code, status.HTTP_200_OK)
        self.assertEqual(slots.data["duration_minutes"], 60)
        self.assertEqual(slots.data["timezone"], "Africa/Luanda")
        self.assertEqual(
            slots.data["slots"],
            [
                self.slot_start.isoformat(),
                (self.slot_start + timedelta(hours=1)).isoformat(),
            ],
        )
        self.assertEqual(selected.status_code, status.HTTP_200_OK)
        self.assertEqual(selected.data["status"], Booking.Status.SCHEDULED)
        self.assertEqual(selected.data["scheduled_at"], self.slot_start.isoformat())

    def test__unavailable_slot_and_conflicting_contratacao_estao_rejected(self):
        competing_proposal = Proposal.objects.create(
            order=ServiceOrder.objects.create(
                client=self.client_user,
                category=self.order.category,
                title="Outro pedido",
                description="Pedido.",
                municipality=self.order.municipality,
                municipality_name_snapshot="Talatona",
                province_name_snapshot="Luanda",
            ),
            provider=self.provider,
            price="10000.00",
            currency="AOA",
            description="Proposta.",
            estimated_days=1,
        )
        competing_booking = Booking.objects.create(
            order=competing_proposal.order,
            proposal=competing_proposal,
            client=self.client_user,
            provider=self.provider,
            final_price="10000.00",
            duration_minutes=60,
            currency="AOA",
            scheduled_at=self.slot_start + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
        )
        self.client.force_authenticate(self.client_user)
        slots = self.client.get(
            reverse("booking-available-slots", args=(self.booking.pk,)),
            {"date": self.slot_start.date().isoformat()},
        )
        unavailable = self.client.post(
            reverse("booking-schedule", args=(self.booking.pk,)),
            {
                "scheduled_at": (self.slot_start + timedelta(hours=1)).isoformat(),
            },
        )
        outside_window = self.client.post(
            reverse("booking-schedule", args=(self.booking.pk,)),
            {
                "scheduled_at": (self.slot_start + timedelta(hours=2)).isoformat(),
            },
        )

        self.assertEqual(slots.data["slots"], [self.slot_start.isoformat()])
        self.assertEqual(unavailable.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(outside_window.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(competing_booking.status, Booking.Status.CONFIRMED)

    def test__contratacao_nao_pode_ser_confirmed_antes_a_slot_esta_selected(self):
        self.booking.scheduled_at = None
        self.booking.save(update_fields=("scheduled_at", "updated_at"))
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("booking-confirm", args=(self.booking.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.SCHEDULED)

    def test__available_slots_rejeitar_invalido_date(self):
        self.client.force_authenticate(self.client_user)

        resposta = self.client.get(
            reverse("booking-available-slots", args=(self.booking.pk,)),
            {"date": "not-a-date"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__schedule_exige_explicit_timezone(self):
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("booking-schedule", args=(self.booking.pk,)),
            {"scheduled_at": self.slot_start.strftime("%Y-%m-%dT%H:%M:%S")},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__apenas_contracted_prestador_pode_start_confirmed_contratacao(self):
        self.booking.status = Booking.Status.CONFIRMED
        self.booking.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.outsider)
        proibido = self.client.post(
            reverse("booking-start", args=(self.booking.pk,))
        )
        self.client.force_authenticate(self.provider_user)
        resposta = self.client.post(
            reverse("booking-start", args=(self.booking.pk,))
        )

        self.assertEqual(proibido.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.IN_PROGRESS)

    def test__apenas_cliente_pode_complete_em_progress_contratacao(self):
        self.booking.status = Booking.Status.IN_PROGRESS
        self.booking.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.provider_user)
        proibido = self.client.post(
            reverse("booking-complete", args=(self.booking.pk,))
        )
        self.client.force_authenticate(self.client_user)
        resposta = self.client.post(
            reverse("booking-complete", args=(self.booking.pk,))
        )

        self.assertEqual(proibido.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.COMPLETED)
        self.assertIsNotNone(self.booking.completed_at)
        self.assertEqual(self.order.status, ServiceOrder.Status.COMPLETED)

    def test__cancellation_esta_limited_para_participants_and_antes_execution(self):
        self.client.force_authenticate(self.outsider)
        proibido = self.client.post(
            reverse("booking-cancel", args=(self.booking.pk,))
        )
        self.client.force_authenticate(self.provider_user)
        resposta = self.client.post(
            reverse("booking-cancel", args=(self.booking.pk,))
        )

        self.assertEqual(proibido.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CANCELLED)
        self.assertEqual(self.order.status, ServiceOrder.Status.CANCELLED)

    def test__started_contratacao_nao_pode_ser_cancelado(self):
        self.booking.status = Booking.Status.IN_PROGRESS
        self.booking.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("booking-cancel", args=(self.booking.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.IN_PROGRESS)

    def test__utilizador_nao_pode_modify_contratacao_campos_na_api(self):
        self.client.force_authenticate(self.client_user)

        resposta = self.client.patch(
            reverse("booking-detail", args=(self.booking.pk,)),
            {"final_price": "1.00"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
