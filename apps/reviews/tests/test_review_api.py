from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.bookings.models import Booking
from apps.catalog.models import Category
from apps.locations.models import Municipality, Province
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider
from apps.reviews.models import Review

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ReviewApiTests(APITestCase):
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
        prestador = Provider.objects.create(
            user=self.provider_user,
            commercial_name="Assistência Luanda",
            verification_status=Provider.VerificationStatus.VERIFIED,
        )
        pedido = ServiceOrder.objects.create(
            client=self.client_user,
            category=categoria,
            title="Reparar computador",
            description="Pedido.",
            municipality=municipio,
            municipality_name_snapshot=municipio.name,
            province_name_snapshot=provincia.name,
            status=ServiceOrder.Status.COMPLETED,
        )
        proposta = Proposal.objects.create(
            order=pedido,
            provider=prestador,
            price="18000.00",
            currency="AOA",
            description="Proposta.",
            estimated_days=2,
            status=Proposal.Status.ACCEPTED,
        )
        self.booking = Booking.objects.create(
            order=pedido,
            proposal=proposta,
            client=self.client_user,
            provider=prestador,
            final_price=proposta.price,
            currency="AOA",
            status=Booking.Status.COMPLETED,
        )
        self.provider = prestador
        self.list_url = reverse("review-list")

    def test__apenas_cliente_pode_criar_avaliacao_para_completed_contratacao(self):
        self.client.force_authenticate(self.outsider)
        proibido = self.client.post(
            self.list_url,
            {"booking_id": self.booking.pk, "rating": 5, "comment": "Excelente."},
        )

        self.client.force_authenticate(self.client_user)
        resposta = self.client.post(
            self.list_url,
            {"booking_id": self.booking.pk, "rating": 5, "comment": "Excelente."},
        )

        self.assertEqual(proibido.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["provider_id"], self.provider.pk)
        self.assertEqual(resposta.data["provider_name"], self.provider.commercial_name)
        self.assertNotIn("client", resposta.data)
        self.assertEqual(Review.objects.get().booking_id, self.booking.pk)

    def test__public_avaliacoes_pode_ser_filtered_por_prestador(self):
        review = Review.objects.create(
            booking=self.booking,
            rating=4,
            comment="Bom serviço.",
        )

        resposta = self.client.get(
            self.list_url,
            {"provider_id": self.provider.pk},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["count"], 1)
        self.assertEqual(resposta.data["results"][0]["id"], review.pk)
        self.assertNotIn("client", resposta.data["results"][0])

    def test__public_prestador_summary_reports_average_and_count(self):
        Review.objects.create(booking=self.booking, rating=4)

        resposta = self.client.get(
            reverse("review-summary"),
            {"provider_id": self.provider.pk},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resposta.data,
            {
                "provider_id": self.provider.pk,
                "average_rating": "4.00",
                "review_count": 1,
            },
        )

    def test__non_completed_contratacao_nao_pode_ser_reviewed(self):
        self.booking.status = Booking.Status.IN_PROGRESS
        self.booking.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            self.list_url,
            {"booking_id": self.booking.pk, "rating": 5},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Review.objects.exists())

    def test__contratacao_pode_apenas_ser_reviewed_once(self):
        self.client.force_authenticate(self.client_user)
        payload = {"booking_id": self.booking.pk, "rating": 5}
        primeiro = self.client.post(self.list_url, payload)
        second = self.client.post(self.list_url, payload)

        self.assertEqual(primeiro.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Review.objects.count(), 1)

    def test__rating_and_comment_estao_validated(self):
        self.client.force_authenticate(self.client_user)

        for rating in (0, 6):
            with self.subTest(rating=rating):
                resposta = self.client.post(
                    self.list_url,
                    {"booking_id": self.booking.pk, "rating": rating},
                )
                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

        resposta = self.client.post(
            self.list_url,
            {
                "booking_id": self.booking.pk,
                "rating": 5,
                "comment": "x" * 2001,
            },
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Review.objects.exists())

    def test__utilizador_nao_pode_supply_outro_prestador_ou_alterar_avaliacao(self):
        self.client.force_authenticate(self.client_user)
        resposta = self.client.post(
            self.list_url,
            {
                "booking_id": self.booking.pk,
                "rating": 5,
                "provider_id": self.provider.pk,
            },
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

        review = Review.objects.create(booking=self.booking, rating=5)
        update_response = self.client.patch(
            reverse("review-list"),
            {"rating": 1},
        )
        self.assertEqual(update_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        review.refresh_from_db()
        self.assertEqual(review.rating, 5)

    def test__invalido_prestador_filter_esta_reported(self):
        resposta = self.client.get(self.list_url, {"provider_id": "invalid"})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
