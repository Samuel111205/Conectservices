from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings


class SeedCatalogDemoTests(SimpleTestCase):
    @override_settings(DEBUG=False)
    def test__seed_demo_e_bloqueado_fora_de_debug(self):
        with self.assertRaisesMessage(
            CommandError,
            "O seed de demonstração só pode ser executado com DEBUG=True.",
        ):
            call_command("seed_catalog_demo")
