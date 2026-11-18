from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.test import APITestCase

from apps.bookings.models import Booking
from apps.catalog.models import Category
from apps.locations.models import Municipality, Province
from apps.messaging.models import Notification
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider
from apps.payments.models import (
    Payment,
    PaymentAuditEvent,
    RefundAuditEvent,
    RefundRequest,
)
from apps.payments.services import avaliar_pagamento

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class PaymentApiTests(APITestCase):
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
        self.admin_user = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-123!",
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
            status=ServiceOrder.Status.AWARDED,
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
            status=Booking.Status.CONFIRMED,
        )
        self.list_url = reverse("payment-list")

    def test__cliente_pode_registar_full_external_pagamento_para_contratacao(self):
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            self.list_url,
            {
                "booking_id": self.booking.pk,
                "method": Payment.Method.BANK_TRANSFER,
                "external_reference": "TRX-2026-001",
                "amount": "1.00",
                "currency": "USD",
                "status": Payment.Status.CONFIRMED,
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Payment.objects.exists())

        resposta = self.client.post(
            self.list_url,
            {
                "booking_id": self.booking.pk,
                "method": Payment.Method.BANK_TRANSFER,
                "external_reference": "TRX-2026-001",
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["amount"], "18000.00")
        self.assertEqual(resposta.data["currency"], "AOA")
        self.assertEqual(resposta.data["status"], Payment.Status.PENDING)
        evento = PaymentAuditEvent.objects.get(payment_id=resposta.data["id"])
        self.assertEqual(evento.actor, self.client_user)
        self.assertEqual(evento.previous_status, "")
        self.assertEqual(evento.new_status, Payment.Status.PENDING)

    def test__apenas_cliente_pode_registar_pagamento_and_apenas_participants_pode_listar(self):
        self.client.force_authenticate(self.outsider)
        proibido = self.client.post(
            self.list_url,
            {"booking_id": self.booking.pk, "method": Payment.Method.CASH},
        )
        outsider_list = self.client.get(self.list_url)

        self.client.force_authenticate(self.client_user)
        client_list = self.client.get(self.list_url)
        pagamento = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.final_price,
            currency=self.booking.currency,
            method=Payment.Method.CASH,
        )

        self.client.force_authenticate(self.provider_user)
        provider_list = self.client.get(self.list_url)

        self.assertEqual(proibido.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(outsider_list.data["count"], 0)
        self.assertEqual(client_list.data["count"], 0)
        self.assertEqual(provider_list.data["count"], 1)
        self.assertEqual(provider_list.data["results"][0]["id"], pagamento.pk)

    def test__apenas_administrador_pode_confirm_ou_rejeitar_and_rejected_pagamento_pode_retry(self):
        self.client.force_authenticate(self.client_user)
        resposta = self.client.post(
            self.list_url,
            {"booking_id": self.booking.pk, "method": Payment.Method.CASH},
        )
        pagamento = Payment.objects.get(pk=resposta.data["id"])

        with self.assertRaises(PermissionDenied):
            avaliar_pagamento(
                payment_id=pagamento.pk,
                actor=self.client_user,
                status=Payment.Status.CONFIRMED,
            )
        rejected = avaliar_pagamento(
            payment_id=pagamento.pk,
            actor=self.admin_user,
            status=Payment.Status.REJECTED,
        )
        self.assertEqual(rejected.status, Payment.Status.REJECTED)
        self.assertEqual(rejected.reviewed_by_id, self.admin_user.pk)
        self.assertIsNotNone(rejected.reviewed_at)
        evento = PaymentAuditEvent.objects.get(
            payment=rejected,
            new_status=Payment.Status.REJECTED,
        )
        self.assertEqual(evento.actor, self.admin_user)
        self.assertEqual(evento.previous_status, Payment.Status.PENDING)
        self.assertEqual(evento.new_status, Payment.Status.REJECTED)

        retry = self.client.post(
            self.list_url,
            {"booking_id": self.booking.pk, "method": Payment.Method.MULTICAIXA},
        )
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)

    def test__apenas_one_pendente_ou_confirmed_pagamento_per_contratacao(self):
        self.client.force_authenticate(self.client_user)
        payload = {"booking_id": self.booking.pk, "method": Payment.Method.CASH}
        primeiro = self.client.post(self.list_url, payload)
        second = self.client.post(self.list_url, payload)

        self.assertEqual(primeiro.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Payment.objects.filter(booking=self.booking).count(), 1)

    def test__pagamento_inexistente_retorna_404_ao_revisto(self):
        with self.assertRaises(NotFound):
            avaliar_pagamento(
                payment_id=999999,
                actor=self.admin_user,
                status=Payment.Status.CONFIRMED,
            )

    def test__nao_pode_registar_pagamento_para_cancelado_contratacao(self):
        self.booking.status = Booking.Status.CANCELLED
        self.booking.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            self.list_url,
            {"booking_id": self.booking.pk, "method": Payment.Method.CASH},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Payment.objects.exists())

    def test__reembolso_exige_pagamento_confirmado_and_cliente_pagador(self):
        url = reverse("refund-request-list")
        payload = {
            "booking_id": self.booking.pk,
            "amount": "5000.00",
            "reason": "O serviço foi parcialmente interrompido.",
        }
        self.client.force_authenticate(self.client_user)
        without_payment = self.client.post(url, payload)

        pagamento = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.final_price,
            currency=self.booking.currency,
            method=Payment.Method.BANK_TRANSFER,
            status=Payment.Status.CONFIRMED,
            reviewed_by=self.admin_user,
        )
        self.client.force_authenticate(self.provider_user)
        provider_request = self.client.post(url, payload)
        self.client.force_authenticate(self.outsider)
        outsider_list = self.client.get(url)
        self.client.force_authenticate(self.client_user)
        created = self.client.post(url, payload)

        self.assertEqual(without_payment.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(provider_request.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(outsider_list.data["count"], 0)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["payment_id"], pagamento.pk)
        self.assertEqual(created.data["amount"], "5000.00")
        self.assertTrue(
            Notification.objects.filter(
                kind=Notification.Kind.REFUND,
                recipient=self.provider_user,
                refund_request_id=created.data["id"],
            ).exists()
        )

    def test__limita_valor_pedido_and_um_pendente_e_audita_devolucao_manual(self):
        pagamento = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.final_price,
            currency=self.booking.currency,
            method=Payment.Method.BANK_TRANSFER,
            status=Payment.Status.CONFIRMED,
            reviewed_by=self.admin_user,
        )
        url = reverse("refund-request-list")
        self.client.force_authenticate(self.client_user)
        excessive = self.client.post(
            url,
            {
                "booking_id": self.booking.pk,
                "amount": "18000.01",
                "reason": "Pedido acima do total pago.",
            },
        )
        first = self.client.post(
            url,
            {
                "booking_id": self.booking.pk,
                "amount": "5000.00",
                "reason": "Serviço parcialmente interrompido.",
            },
        )
        second_pending = self.client.post(
            url,
            {
                "booking_id": self.booking.pk,
                "amount": "1000.00",
                "reason": "Outro pedido enquanto o primeiro está pendente.",
            },
        )

        self.assertEqual(excessive.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_pending.status_code, status.HTTP_400_BAD_REQUEST)
        pedido = RefundRequest.objects.get(payment=pagamento)
        self.assertTrue(
            RefundAuditEvent.objects.filter(
                refund_request=pedido,
                new_status=RefundRequest.Status.REQUESTED,
            ).exists()
        )

        self.client.force_authenticate(self.admin_user)
        reviewed = self.client.post(
            reverse("refund-request-review", args=(pedido.pk,)),
            {
                "status": RefundRequest.Status.APPROVED,
                "decision_note": "Devolução parcial aprovada.",
            },
        )
        self.client.force_authenticate(self.provider_user)
        confirmed = self.client.post(
            reverse("refund-request-confirm-paid", args=(pedido.pk,)),
            {"payout_reference": "TRF-2026-0009"},
        )

        self.assertEqual(reviewed.status_code, status.HTTP_200_OK)
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertEqual(confirmed.data["status"], RefundRequest.Status.PAID)
        self.assertEqual(confirmed.data["payout_reference"], "TRF-2026-0009")
        pedido.refresh_from_db()
        self.assertIsNotNone(pedido.refunded_at)
        self.assertEqual(
            RefundAuditEvent.objects.filter(refund_request=pedido).count(),
            3,
        )
        self.assertEqual(
            Notification.objects.filter(
                kind=Notification.Kind.REFUND,
                refund_request=pedido,
            ).count(),
            3,
        )
