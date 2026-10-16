import json
from smtplib import SMTPException
from unittest.mock import MagicMock, Mock, patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail.backends.base import BaseEmailBackend
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category
from apps.locations.models import Municipality, Province
from apps.messaging.admin import retry_notification_emails
from apps.messaging.models import Conversation, Message, Notification, PushDeviceToken
from apps.orders.models import ServiceOrder
from apps.proposals.models import Proposal
from apps.providers.models import Provider

User = get_user_model()


class FailingEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        raise SMTPException("SMTP indisponível para o teste.")


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class MessagingApiTests(APITestCase):
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
            status=ServiceOrder.Status.NEGOTIATING,
        )
        self.proposal = Proposal.objects.create(
            order=pedido,
            provider=prestador,
            price="18000.00",
            currency="AOA",
            description="Proposta.",
            estimated_days=2,
            status=Proposal.Status.PENDING,
        )
        self.open_url = reverse("conversation-list")
        self.notification_url = reverse("notification-list")

    def abrir_conversa(self, user):
        self.client.force_authenticate(user)
        resposta = self.client.post(
            self.open_url,
            {"proposal_id": self.proposal.pk},
        )
        self.assertIn(
            resposta.status_code,
            (status.HTTP_200_OK, status.HTTP_201_CREATED),
        )
        return Conversation.objects.get(pk=resposta.data["id"])

    def test__apenas_proposta_participants_pode_open_private_conversa(self):
        self.client.force_authenticate(self.outsider)
        proibido = self.client.post(
            self.open_url,
            {"proposal_id": self.proposal.pk},
        )
        self.client.force_authenticate(self.client_user)
        criado = self.client.post(
            self.open_url,
            {"proposal_id": self.proposal.pk},
        )
        duplicate = self.client.post(
            self.open_url,
            {"proposal_id": self.proposal.pk},
        )

        self.assertEqual(proibido.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(criado.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate.status_code, status.HTTP_200_OK)
        self.assertEqual(Conversation.objects.count(), 1)
        self.assertEqual(criado.data["order_title"], "Reparar computador")
        self.assertNotIn("address", criado.data)

    def test__apenas_participants_pode_listar_ou_retrieve_conversa(self):
        conversa = self.abrir_conversa(self.client_user)
        self.client.force_authenticate(self.outsider)

        listed = self.client.get(self.open_url)
        retrieved = self.client.get(
            reverse("conversation-detail", args=(conversa.pk,))
        )

        self.assertEqual(listed.data["count"], 0)
        self.assertEqual(retrieved.status_code, status.HTTP_404_NOT_FOUND)

    def test__mensagem_cria_private_notificacao_para_other_participant(self):
        conversa = self.abrir_conversa(self.provider_user)
        messages_url = reverse("conversation-messages", args=(conversa.pk,))
        self.client.force_authenticate(self.provider_user)
        resposta = self.client.post(messages_url, {"body": "Tenho disponibilidade."})

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["sender_id"], self.provider_user.pk)
        notificacao = Notification.objects.get()
        self.assertEqual(notificacao.recipient_id, self.client_user.pk)
        self.assertEqual(notificacao.actor_id, self.provider_user.pk)
        self.assertEqual(notificacao.conversation_id, conversa.pk)
        self.assertEqual(notificacao.message_id, resposta.data["id"])
        self.assertEqual(notificacao.body, "Tenho disponibilidade.")
        self.assertEqual(notificacao.email_status, Notification.EmailStatus.PENDING)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL="Conect Services <noreply@example.com>",
        WEB_APP_URL="https://app.example.com",
    )
    def test__mensagem_correio_eletronico_esta_delivered_para_other_participant_depois_commit(self):
        conversa = self.abrir_conversa(self.provider_user)
        messages_url = reverse("conversation-messages", args=(conversa.pk,))

        with self.captureOnCommitCallbacks(execute=True):
            resposta = self.client.post(
                messages_url,
                {"body": "A tua reparação está agendada."},
            )

        notificacao = Notification.objects.get()
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.client_user.email])
        self.assertEqual(mail.outbox[0].subject, "Nova mensagem")
        self.assertIn("A tua reparação está agendada.", mail.outbox[0].body)
        self.assertIn("https://app.example.com", mail.outbox[0].body)
        self.assertEqual(notificacao.email_status, Notification.EmailStatus.SENT)
        self.assertIsNotNone(notificacao.email_sent_at)
        self.assertEqual(notificacao.email_error, "")

    @override_settings(
        EMAIL_BACKEND="apps.messaging.tests.test_messaging_api.FailingEmailBackend",
        EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL="noreply@example.com",
    )
    def test__smtp_falha_keeps_mensagem_and_marks_correio_eletronico_para_administrador_retry(self):
        conversa = self.abrir_conversa(self.provider_user)
        messages_url = reverse("conversation-messages", args=(conversa.pk,))

        with self.assertLogs("apps.messaging.email", level="ERROR"):
            with self.captureOnCommitCallbacks(execute=True):
                resposta = self.client.post(
                    messages_url,
                    {"body": "Mensagem persistida mesmo sem SMTP."},
                )

        notificacao = Notification.objects.get()
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(notificacao.email_status, Notification.EmailStatus.FAILED)
        self.assertIn("logs", notificacao.email_error)
        self.assertEqual(Message.objects.count(), 1)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL="noreply@example.com",
    )
    def test__administrador_pode_retry_falhou_notificacao_correio_eletronico(self):
        conversa = self.abrir_conversa(self.provider_user)
        mensagem = Message.objects.create(
            conversation=conversa,
            sender=self.provider_user,
            body="Mensagem para reenviar.",
        )
        notificacao = Notification.objects.create(
            recipient=self.client_user,
            actor=self.provider_user,
            conversation=conversa,
            message=mensagem,
            kind=Notification.Kind.MESSAGE,
            title="Nova mensagem",
            body=mensagem.body,
            email_status=Notification.EmailStatus.FAILED,
            email_error="Falha anterior.",
        )
        modeladmin = Mock()

        retry_notification_emails(
            modeladmin,
            RequestFactory().get("/admin/apps/messaging/notification/"),
            Notification.objects.filter(pk=notificacao.pk),
        )

        notificacao.refresh_from_db()
        self.assertEqual(notificacao.email_status, Notification.EmailStatus.SENT)
        self.assertEqual(len(mail.outbox), 1)
        modeladmin.message_user.assert_called_once()

    def test__cliente_reply_notifies_prestador_and_blank_ou_long_mensagens_estao_rejected(self):
        conversa = self.abrir_conversa(self.client_user)
        messages_url = reverse("conversation-messages", args=(conversa.pk,))
        self.client.force_authenticate(self.client_user)

        blank = self.client.post(messages_url, {"body": "  "})
        long_message = self.client.post(messages_url, {"body": "x" * 5001})
        sent = self.client.post(messages_url, {"body": "Obrigado."})

        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(long_message.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(sent.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Notification.objects.get().recipient_id, self.provider_user.pk)

    def test__proposta_rejection_keeps_history_but_closes_writing(self):
        conversa = self.abrir_conversa(self.client_user)
        Message.objects.create(
            conversation=conversa,
            sender=self.client_user,
            body="Mensagem anterior.",
        )
        self.proposal.status = Proposal.Status.REJECTED
        self.proposal.save(update_fields=("status", "updated_at"))
        messages_url = reverse("conversation-messages", args=(conversa.pk,))
        self.client.force_authenticate(self.provider_user)

        listed = self.client.get(self.open_url)
        history = self.client.get(messages_url)
        rejected = self.client.post(messages_url, {"body": "Nova mensagem."})

        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data["count"], 1)
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)

    def test__canceled_pedido_closes_conversa_writing(self):
        conversa = self.abrir_conversa(self.client_user)
        self.proposal.order.status = ServiceOrder.Status.CANCELLED
        self.proposal.order.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(
            reverse("conversation-messages", args=(conversa.pk,)),
            {"body": "Ainda aqui."},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test__notificacao_inbox_count_and_read_estao_private_and_idempotent(self):
        conversa = self.abrir_conversa(self.client_user)
        mensagem = Message.objects.create(
            conversation=conversa,
            sender=self.provider_user,
            body="Olá.",
        )
        notificacao = Notification.objects.create(
            recipient=self.client_user,
            actor=self.provider_user,
            conversation=conversa,
            message=mensagem,
            kind=Notification.Kind.MESSAGE,
            title="Nova mensagem",
            body="Olá.",
        )
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.notification_url).data["count"], 0)
        self.assertEqual(
            self.client.get(reverse("notification-unread-count")).data["unread_count"],
            0,
        )
        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.get(self.notification_url).data["count"], 1)
        self.assertEqual(
            self.client.get(reverse("notification-unread-count")).data["unread_count"],
            1,
        )

        marked = self.client.post(
            reverse("notification-read", args=(notificacao.pk,)),
        )
        repeated = self.client.post(
            reverse("notification-read", args=(notificacao.pk,)),
        )
        notificacao.refresh_from_db()

        self.assertEqual(marked.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(marked.data["read_at"])
        self.assertEqual(repeated.data["read_at"], marked.data["read_at"])
        self.assertIsNotNone(notificacao.read_at)

    def test__reading_conversa_marks_apenas_its_notificacoes_read(self):
        primeiro = self.abrir_conversa(self.client_user)
        other_proposal = Proposal.objects.create(
            order=ServiceOrder.objects.create(
                client=self.client_user,
                category=self.proposal.order.category,
                title="Outro pedido",
                description="Pedido.",
                municipality=self.proposal.order.municipality,
                municipality_name_snapshot="Talatona",
                province_name_snapshot="Luanda",
            ),
            provider=self.proposal.provider,
            price="1000.00",
            currency="AOA",
            description="Outra proposta.",
            estimated_days=1,
        )
        second = Conversation.objects.create(proposal=other_proposal)
        for conversa in (primeiro, second):
            mensagem = Message.objects.create(
                conversation=conversa,
                sender=self.provider_user,
                body="Nova mensagem.",
            )
            Notification.objects.create(
                recipient=self.client_user,
                actor=self.provider_user,
                conversation=conversa,
                message=mensagem,
                kind=Notification.Kind.MESSAGE,
                title="Nova mensagem",
                body=mensagem.body,
            )

        self.client.force_authenticate(self.client_user)
        resposta = self.client.get(
            reverse("conversation-messages", args=(primeiro.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        first_notification = Notification.objects.get(conversation=primeiro)
        second_notification = Notification.objects.get(conversation=second)
        self.assertIsNotNone(first_notification.read_at)
        self.assertIsNone(second_notification.read_at)

    def test__read_all_apenas_marks_current_utilizadores_notificacoes(self):
        conversa = self.abrir_conversa(self.client_user)
        mensagem = Message.objects.create(
            conversation=conversa,
            sender=self.provider_user,
            body="Mensagem.",
        )
        notificacao = Notification.objects.create(
            recipient=self.client_user,
            actor=self.provider_user,
            conversation=conversa,
            message=mensagem,
            kind=Notification.Kind.MESSAGE,
            title="Nova mensagem",
            body="Mensagem.",
        )
        self.client.force_authenticate(self.client_user)

        resposta = self.client.post(reverse("notification-read-all"))
        notificacao.refresh_from_db()

        self.assertEqual(resposta.data["marked_read"], 1)
        self.assertIsNotNone(notificacao.read_at)
        self.assertEqual(
            self.client.get(reverse("notification-unread-count")).data["unread_count"],
            0,
        )

    def test__push_token_registration_requires_auth_and_is_idempotent(self):
        endpoint = reverse("push-token-list")
        token = "ExponentPushToken[device_123]"

        anonymous = self.client.post(
            endpoint,
            {"token": token, "platform": "ANDROID"},
        )
        self.client.force_authenticate(self.client_user)
        first = self.client.post(endpoint, {"token": token, "platform": "ANDROID"})
        second = self.client.post(endpoint, {"token": token, "platform": "ANDROID"})
        invalid = self.client.post(
            endpoint,
            {"token": "not-a-push-token", "platform": "ANDROID"},
        )

        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PushDeviceToken.objects.filter(user=self.client_user).count(), 1)

    def test__push_token_deactivation_is_scoped_to_authenticated_owner(self):
        dispositivo = PushDeviceToken.objects.create(
            user=self.client_user,
            token="ExponentPushToken[device_456]",
            platform=PushDeviceToken.Platform.ANDROID,
        )
        endpoint = reverse("push-token-deactivate")
        self.client.force_authenticate(self.outsider)
        other_user = self.client.post(endpoint, {"token": dispositivo.token})
        self.client.force_authenticate(self.client_user)
        owner = self.client.post(endpoint, {"token": dispositivo.token})
        dispositivo.refresh_from_db()

        self.assertEqual(other_user.status_code, status.HTTP_200_OK)
        self.assertFalse(other_user.data["deactivated"])
        self.assertTrue(owner.data["deactivated"])
        self.assertFalse(dispositivo.is_active)

    @override_settings(PUSH_NOTIFICATIONS_ENABLED=True)
    def test__push_usa_aviso_generico_e_nao_expoe_corpo_da_mensagem(self):
        from apps.messaging.services import enviar_push_notification

        conversa = self.abrir_conversa(self.provider_user)
        mensagem = Message.objects.create(
            conversation=conversa,
            sender=self.provider_user,
            body="Detalhe confidencial do cliente.",
        )
        notificacao = Notification.objects.create(
            recipient=self.client_user,
            actor=self.provider_user,
            conversation=conversa,
            message=mensagem,
            kind=Notification.Kind.MESSAGE,
            title="Nova mensagem",
            body=mensagem.body,
        )
        PushDeviceToken.objects.create(
            user=self.client_user,
            token="ExponentPushToken[device_789]",
            platform=PushDeviceToken.Platform.ANDROID,
        )
        response = MagicMock()
        response.read.return_value = json.dumps(
            {"data": [{"status": "ok", "id": "ticket-1"}]}
        ).encode("utf-8")
        response.__enter__.return_value = response

        with patch("apps.messaging.services.urlopen", return_value=response) as send:
            delivered = enviar_push_notification(notification_id=notificacao.pk)

        push_payload = json.loads(send.call_args.args[0].data)
        self.assertTrue(delivered)
        self.assertEqual(push_payload[0]["body"], "Tens uma nova mensagem sobre um serviço.")
        self.assertNotIn("Detalhe confidencial", json.dumps(push_payload))
