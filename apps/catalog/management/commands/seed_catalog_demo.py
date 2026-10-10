from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.catalog.models import Category, Service
from apps.locations.models import Municipality, Province, ProviderCoverage
from apps.providers.models import Provider
from apps.accounts.models import User


class Command(BaseCommand):
    help = "Seeds the catalog with realistic demo categories, verified providers and services."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "O seed de demonstração só pode ser executado com DEBUG=True."
            )
        with transaction.atomic():
            categories = [
                ("Tecnologia e informática", "Assistência técnica, redes, software e suporte digital."),
                ("Reparações e manutenção", "Reparação residencial, elétrica, hidráulica e manutenção geral."),
                ("Consultoria", "Assessoria profissional para negócios, processos e estratégia."),
                ("Design e marketing", "Identidade visual, branding, social media e campanhas."),
                ("Educação e formação", "Aulas, cursos, coaching e formação especializada."),
                ("Limpeza e organização", "Serviços domésticos, organização e manutenção de espaços."),
                ("Saúde e bem-estar", "Bem-estar, estética, fisioterapia e cuidados pessoais."),
                ("Eventos e festas", "Catering, decoração, música e organização de eventos."),
            ]
            category_map = {}
            for name, description in categories:
                category, created = Category.objects.get_or_create(
                    name=name,
                    defaults={"description": description, "is_active": True},
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f"Created category: {name}"))
                category_map[name] = category

            province, _ = Province.objects.get_or_create(name="Luanda", defaults={"code": "LUA"})
            municipality_names = ["Talatona", "Maianga", "Benfica", "Viana", "Kilamba Kiaxi"]
            municipalities = {}
            for municipality_name in municipality_names:
                municipality, created = Municipality.objects.get_or_create(
                    province=province,
                    name=municipality_name,
                )
                municipalities[municipality_name] = municipality
                if created:
                    self.stdout.write(self.style.SUCCESS(f"Created municipality: {municipality_name}"))

            provider_specs = [
                {
                    "email": "techlab@demo.com",
                    "name": "TechLab Angola",
                    "description": "Suporte técnico, manutenção de computadores e redes para empresas e famílias.",
                    "category": "Tecnologia e informática",
                    "services": [
                        ("Assistência técnica informática", "Suporte remoto e presencial para computadores, laptops e redes.", "15000.00", "15000.00", "FIXED", 120),
                        ("Manutenção de rede", "Configuração e troubleshooting de internet e infraestrutura local.", "25000.00", "42000.00", "RANGE", 180),
                    ],
                    "municipalities": ["Talatona", "Benfica"],
                },
                {
                    "email": "fixhome@demo.com",
                    "name": "FixHome Services",
                    "description": "Serviços de reparação, manutenção residencial e obras de pequena escala.",
                    "category": "Reparações e manutenção",
                    "services": [
                        ("Reparação elétrica residencial", "Correções de tomadas, circuitos e pequenos reparos elétricos.", "12000.00", "12000.00", "FIXED", 90),
                        ("Manutenção hidráulica", "Válvulas, torneiras e pequenos reparos em instalações domésticas.", "18000.00", "26000.00", "RANGE", 150),
                    ],
                    "municipalities": ["Maianga", "Viana"],
                },
                {
                    "email": "bluepoint@demo.com",
                    "name": "BluePoint Consultoria",
                    "description": "Consultoria para negócios, processos e organização de equipes e operações.",
                    "category": "Consultoria",
                    "services": [
                        ("Consultoria de processos", "Diagnóstico e melhoria dos processos da sua empresa.", "35000.00", "35000.00", "FIXED", 150),
                        ("Mentoria de negócios", "Acompanhamento estratégico para gestão e crescimento de negócios.", "50000.00", "90000.00", "RANGE", 180),
                    ],
                    "municipalities": ["Kilamba Kiaxi", "Talatona"],
                },
                {
                    "email": "novaforma@demo.com",
                    "name": "NovaForma Studio",
                    "description": "Design gráfico, branding e apoio à presença digital de marcas e negócios.",
                    "category": "Design e marketing",
                    "services": [
                        ("Identidade visual", "Criação de logo, paleta e guia visual para marca.", "45000.00", "45000.00", "FIXED", 210),
                        ("Gestão de redes sociais", "Produção de conteúdos e calendário de publicação.", "30000.00", "60000.00", "RANGE", 120),
                    ],
                    "municipalities": ["Benfica", "Maianga"],
                },
                {
                    "email": "eduspark@demo.com",
                    "name": "EduSpark Angola",
                    "description": "Formação profissional, aulas e apoio ao desenvolvimento de competências.",
                    "category": "Educação e formação",
                    "services": [
                        ("Aulas particulares", "Reforço escolar e apoio em disciplinas específicas.", "6000.00", "6000.00", "FIXED", 60),
                        ("Cursos corporativos", "Treino para equipas e formação de profissionais.", "70000.00", "140000.00", "RANGE", 240),
                    ],
                    "municipalities": ["Talatona", "Kilamba Kiaxi"],
                },
                {
                    "email": "sparkclean@demo.com",
                    "name": "SparkClean",
                    "description": "Limpeza residencial e comercial com processos profissionais e confiáveis.",
                    "category": "Limpeza e organização",
                    "services": [
                        ("Limpeza residencial", "Serviço completo para casas e apartamentos.", "10000.00", "10000.00", "FIXED", 120),
                        ("Organização de escritórios", "Organização de ambientes de trabalho e materiais.", "22000.00", "42000.00", "RANGE", 180),
                    ],
                    "municipalities": ["Viana", "Benfica"],
                },
            ]

            for provider_spec in provider_specs:
                user, user_created = User.objects.get_or_create(
                    email=provider_spec["email"],
                    defaults={"phone": f"9{abs(hash(provider_spec['email'])) % 100000000:08d}", "is_active": True},
                )
                if user_created:
                    user.set_password("Strong-Password-123!")
                    user.save(update_fields=["password"])

                provider, created = Provider.objects.get_or_create(
                    user=user,
                    defaults={
                        "commercial_name": provider_spec["name"],
                        "description": provider_spec["description"],
                        "business_phone": "+244 912 345 678",
                        "business_email": provider_spec["email"],
                        "verification_status": Provider.VerificationStatus.VERIFIED,
                    },
                )
                if not created:
                    provider.description = provider_spec["description"]
                    provider.business_phone = "+244 912 345 678"
                    provider.business_email = provider_spec["email"]
                    provider.verification_status = Provider.VerificationStatus.VERIFIED
                    provider.save(update_fields=["description", "business_phone", "business_email", "verification_status", "updated_at"])

                for municipality_name in provider_spec["municipalities"]:
                    municipality = municipalities[municipality_name]
                    ProviderCoverage.objects.get_or_create(
                        provider=provider,
                        municipality=municipality,
                        defaults={"radius_km": 15.0},
                    )

                for service_name, description, minimum_price, maximum_price, price_type, duration in provider_spec["services"]:
                    category = category_map[provider_spec["category"]]
                    Service.objects.get_or_create(
                        provider=provider,
                        category=category,
                        name=service_name,
                        defaults={
                            "description": description,
                            "minimum_price": minimum_price,
                            "maximum_price": maximum_price,
                            "currency": "AOA",
                            "price_type": price_type,
                            "duration_minutes": duration,
                            "is_active": True,
                        },
                    )

                self.stdout.write(self.style.SUCCESS(f"Ensured provider: {provider_spec['name']}"))

            self.stdout.write(self.style.SUCCESS("Catalog demo seed completed."))
