from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import CatalogAuditEvent, Category

User = get_user_model()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class CategoryApiTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Casa")
        self.user = User.objects.create_user(
            "client@example.com",
            "Strong-Password-123!",
        )
        self.admin = User.objects.create_superuser(
            "admin@example.com",
            "Admin-Strong-Password-789!",
        )

    def test__active_categorias_estao_public_and_paginated(self):
        inactive = Category.objects.create(name="Inativa", is_active=False)

        resposta = self.client.get(reverse("category-list"))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        category_ids = [elemento["id"] for elemento in resposta.data["results"]]
        self.assertIn(self.category.pk, category_ids)
        self.assertNotIn(inactive.pk, category_ids)
        self.assertIn("count", resposta.data)

    def test__administrador_pode_listar_inactive_categorias(self):
        inactive = Category.objects.create(name="Inativa", is_active=False)
        self.client.force_authenticate(self.admin)

        resposta = self.client.get(reverse("category-list"))

        self.assertIn(
            inactive.pk,
            [elemento["id"] for elemento in resposta.data["results"]],
        )

    def test__non_administrador_nao_pode_criar_ou_atualizar_categoria(self):
        self.client.force_authenticate(self.user)

        create_response = self.client.post(
            reverse("category-list"),
            {"name": "Tecnologia"},
        )
        update_response = self.client.patch(
            reverse("category-detail", args=(self.category.pk,)),
            {"name": "Alterada"},
        )

        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

    def test__administrador_pode_criar_hierarchical_categoria_and_audit_it(self):
        self.client.force_authenticate(self.admin)

        resposta = self.client.post(
            reverse("category-list"),
            {
                "name": "Eletricidade",
                "parent": self.category.pk,
                "is_active": True,
            },
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        child = Category.objects.get(name="Eletricidade")
        self.assertEqual(child.parent, self.category)
        audit_event = CatalogAuditEvent.objects.get(
            category_id_snapshot=child.pk
        )
        self.assertEqual(
            audit_event.action,
            CatalogAuditEvent.Action.CATEGORY_CREATED,
        )
        self.assertEqual(audit_event.actor, self.admin)

    def test__categoria_nao_pode_ser_its_proprio_parent_ou_criar_a_cycle(self):
        child = Category.objects.create(name="Subcategoria", parent=self.category)
        self.client.force_authenticate(self.admin)

        self_reference = self.client.patch(
            reverse("category-detail", args=(self.category.pk,)),
            {"parent": self.category.pk},
        )
        cycle = self.client.patch(
            reverse("category-detail", args=(self.category.pk,)),
            {"parent": child.pk},
        )

        self.assertEqual(self_reference.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(cycle.status_code, status.HTTP_400_BAD_REQUEST)
        self.category.refresh_from_db()
        self.assertIsNone(self.category.parent)

    def test__parent_nao_pode_ser_deactivated_while_child_esta_active(self):
        Category.objects.create(name="Subcategoria", parent=self.category)
        self.client.force_authenticate(self.admin)

        resposta = self.client.patch(
            reverse("category-detail", args=(self.category.pk,)),
            {"is_active": False},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.category.refresh_from_db()
        self.assertTrue(self.category.is_active)

    def test__eliminar_deactivates_categoria_and_preserva_audit_history(self):
        self.client.force_authenticate(self.admin)

        resposta = self.client.delete(
            reverse("category-detail", args=(self.category.pk,))
        )

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.category.refresh_from_db()
        self.assertFalse(self.category.is_active)
        event = CatalogAuditEvent.objects.get(
            category_id_snapshot=self.category.pk
        )
        self.assertEqual(
            event.action,
            CatalogAuditEvent.Action.CATEGORY_DEACTIVATED,
        )

    def test__invalido_parent_filter_devolve_validation_error(self):
        resposta = self.client.get(
            reverse("category-list"),
            {"parent": "not-a-number"},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
