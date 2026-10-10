from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.providers.models import Provider, ProviderVerificationDocument

User = get_user_model()


class ProviderVerificationApiTests(APITestCase):
    def setUp(self):
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
        self.client.force_authenticate(self.user)
        self.document_url = reverse("provider-verification-documents")

    def tearDown(self):
        for document in ProviderVerificationDocument.objects.filter(
            provider__in=(self.provider, self.other_provider)
        ):
            document.file.storage.delete(document.file.name)
        super().tearDown()

    def enviar_pdf(self):
        return self.client.post(
            self.document_url,
            {
                "document_type": ProviderVerificationDocument.DocumentType.IDENTITY,
                "file": SimpleUploadedFile(
                    "identificacao.pdf",
                    b"%PDF-1.4\nDocumento de teste",
                    content_type="application/pdf",
                ),
            },
            format="multipart",
        )

    def test__upload_lista_apenas_documentos_proprios_sem_expor_ficheiro(self):
        resposta = self.enviar_pdf()

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("file", resposta.data)
        self.assertNotIn("url", resposta.data)
        documento = ProviderVerificationDocument.objects.get(provider=self.provider)
        self.assertTrue(documento.file.name.startswith(f"providers/{self.provider.pk}/"))

        ProviderVerificationDocument.objects.create(
            provider=self.other_provider,
            document_type=ProviderVerificationDocument.DocumentType.OTHER,
            file=SimpleUploadedFile(
                "outro.pdf",
                b"%PDF-1.4\nDocumento privado",
                content_type="application/pdf",
            ),
        )
        resposta_lista = self.client.get(self.document_url)

        self.assertEqual(resposta_lista.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resposta_lista.data["results"]), 1)
        self.assertNotIn("file", resposta_lista.data["results"][0])
        self.assertNotIn("url", resposta_lista.data["results"][0])

    def test__upload_rejeita_ficheiro_invalido_e_superior_a_10_mb(self):
        ficheiro_invalido = self.client.post(
            self.document_url,
            {
                "document_type": ProviderVerificationDocument.DocumentType.IDENTITY,
                "file": SimpleUploadedFile(
                    "documento.txt",
                    b"nao e um documento suportado",
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )
        ficheiro_grande = self.client.post(
            self.document_url,
            {
                "document_type": ProviderVerificationDocument.DocumentType.IDENTITY,
                "file": SimpleUploadedFile(
                    "documento.pdf",
                    b"%PDF-1.4\n" + b"x" * (10 * 1024 * 1024),
                    content_type="application/pdf",
                ),
            },
            format="multipart",
        )

        self.assertEqual(ficheiro_invalido.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ficheiro_grande.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            ProviderVerificationDocument.objects.filter(provider=self.provider).exists()
        )

    def test__submissao_exige_documento_e_bloqueia_duplicacao(self):
        submit_url = reverse("provider-submit-verification")
        sem_documento = self.client.post(submit_url)

        self.assertEqual(sem_documento.status_code, status.HTTP_400_BAD_REQUEST)
        self.enviar_pdf()

        submetida = self.client.post(submit_url)
        duplicada = self.client.post(submit_url)

        self.assertEqual(submetida.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(submetida.data["verification_submitted_at"])
        self.assertEqual(duplicada.status_code, status.HTTP_400_BAD_REQUEST)
        self.provider.refresh_from_db()
        self.assertEqual(
            self.provider.verification_status,
            Provider.VerificationStatus.PENDING,
        )
        self.assertIsNotNone(self.provider.verification_submitted_at)

    def test__prestador_rejeitado_pode_corrigir_documentos_e_submeter_novamente(self):
        self.enviar_pdf()
        self.provider.verification_status = Provider.VerificationStatus.REJECTED
        self.provider.verification_feedback = "Envia um documento legível."
        self.provider.save(
            update_fields=("verification_status", "verification_feedback")
        )

        submissao = self.client.post(reverse("provider-submit-verification"))

        self.assertEqual(submissao.status_code, status.HTTP_200_OK)
        self.provider.refresh_from_db()
        self.assertEqual(
            self.provider.verification_status,
            Provider.VerificationStatus.PENDING,
        )
        self.assertEqual(self.provider.verification_feedback, "")

    def test__documento_de_outro_prestador_nao_pode_ser_removido(self):
        documento = ProviderVerificationDocument.objects.create(
            provider=self.other_provider,
            document_type=ProviderVerificationDocument.DocumentType.OTHER,
            file=SimpleUploadedFile(
                "outro.pdf",
                b"%PDF-1.4\nDocumento privado",
                content_type="application/pdf",
            ),
        )

        resposta = self.client.delete(
            reverse("provider-verification-document-delete", args=(documento.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(
            ProviderVerificationDocument.objects.filter(pk=documento.pk).exists()
        )

    def test__documento_em_analise_fica_bloqueado_e_rejeitado_pode_ser_removido(self):
        self.enviar_pdf()
        documento = ProviderVerificationDocument.objects.get(provider=self.provider)
        url = reverse("provider-verification-document-delete", args=(documento.pk,))
        nome_ficheiro = documento.file.name
        self.client.post(reverse("provider-submit-verification"))

        bloqueada = self.client.delete(url)
        self.assertEqual(bloqueada.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(documento.file.storage.exists(documento.file.name))

        self.provider.verification_status = Provider.VerificationStatus.REJECTED
        self.provider.save(update_fields=("verification_status",))
        removida = self.client.delete(url)

        self.assertEqual(removida.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(documento.file.storage.exists(nome_ficheiro))
        self.assertFalse(
            ProviderVerificationDocument.objects.filter(pk=documento.pk).exists()
        )

    def test__apenas_administrador_pode_transferir_documento(self):
        self.enviar_pdf()
        documento = ProviderVerificationDocument.objects.get(provider=self.provider)
        url = reverse(
            "admin:providers_providerverificationdocument_download",
            args=(documento.pk,),
        )

        resposta_utilizador = self.client.get(url)
        self.assertEqual(resposta_utilizador.status_code, status.HTTP_302_FOUND)

        admin_user = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-789!",
        )
        self.client.force_authenticate(user=None)
        self.client.force_login(admin_user)
        resposta_admin = self.client.get(url)

        self.assertEqual(resposta_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(
            b"".join(resposta_admin.streaming_content),
            b"%PDF-1.4\nDocumento de teste",
        )
        self.assertIn("private", resposta_admin["Cache-Control"])
        self.assertIn("no-store", resposta_admin["Cache-Control"])
        self.assertEqual(resposta_admin["X-Content-Type-Options"], "nosniff")
