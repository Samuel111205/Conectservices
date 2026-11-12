from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


class ProductCategoryFilterTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("product-list")

    def test__category_filter_rejects_non_numeric_values(self):
        response = self.client.get(self.url, {"category": "invalid"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test__category_filter_rejects_identifiers_outside_supported_range(self):
        response = self.client.get(
            self.url,
            {"category": "99999999999999999999"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)
