from django.db.models import (
    Case,
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Cast, Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.reviews.models import Review

from .models import Provider, ProviderVerificationDocument
from .serializers import (
    ProviderDiscoverySerializer,
    ProviderSerializer,
    ProviderVerificationDocumentSerializer,
)


def _anotar_avaliacoes(queryset):
    tipo_decimal = DecimalField(max_digits=14, decimal_places=2)
    avaliacoes_contratacoes = (
        Review.objects.filter(booking__provider_id=OuterRef("pk"))
        .order_by()
        .values("booking__provider_id")
    )
    avaliacoes_encomendas = (
        Review.objects.filter(product_order__provider_id=OuterRef("pk"))
        .order_by()
        .values("product_order__provider_id")
    )
    return queryset.annotate(
        booking_review_total=Coalesce(
            Subquery(
                avaliacoes_contratacoes.annotate(
                    total=Sum("rating", output_field=tipo_decimal),
                ).values("total")[:1],
                output_field=tipo_decimal,
            ),
            Value(0, output_field=tipo_decimal),
            output_field=tipo_decimal,
        ),
        booking_review_count=Coalesce(
            Subquery(
                avaliacoes_contratacoes.annotate(total=Count("pk"))
                .values("total")[:1],
                output_field=IntegerField(),
            ),
            Value(0),
            output_field=IntegerField(),
        ),
        product_review_total=Coalesce(
            Subquery(
                avaliacoes_encomendas.annotate(
                    total=Sum("rating", output_field=tipo_decimal),
                ).values("total")[:1],
                output_field=tipo_decimal,
            ),
            Value(0, output_field=tipo_decimal),
            output_field=tipo_decimal,
        ),
        product_review_count=Coalesce(
            Subquery(
                avaliacoes_encomendas.annotate(total=Count("pk"))
                .values("total")[:1],
                output_field=IntegerField(),
            ),
            Value(0),
            output_field=IntegerField(),
        ),
    ).annotate(
        reviews_total=F("booking_review_total") + F("product_review_total"),
        review_count=F("booking_review_count") + F("product_review_count"),
    ).annotate(
        average_rating=Case(
            When(
                review_count__gt=0,
                then=ExpressionWrapper(
                    Cast(F("reviews_total"), tipo_decimal)
                    / Cast(F("review_count"), tipo_decimal),
                    output_field=DecimalField(max_digits=6, decimal_places=2),
                ),
            ),
            default=Value(
                None,
                output_field=DecimalField(max_digits=6, decimal_places=2),
            ),
            output_field=DecimalField(max_digits=6, decimal_places=2),
        )
    )


class ProviderCreateView(generics.CreateAPIView):
    serializer_class = ProviderSerializer
    permission_classes = (IsAuthenticated,)


class CurrentProviderView(generics.RetrieveUpdateAPIView):
    serializer_class = ProviderSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "patch", "head", "options")

    def get_object(self):
        return get_object_or_404(Provider, user=self.request.user)


class ProviderVerificationDocumentListCreateView(generics.ListCreateAPIView):
    serializer_class = ProviderVerificationDocumentSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_provider(self):
        provider = getattr(self.request.user, "provider", None)
        if provider is None:
            raise PermissionDenied("Cria primeiro o perfil de prestador.")
        if provider.verification_status in (
            Provider.VerificationStatus.VERIFIED,
            Provider.VerificationStatus.SUSPENDED,
        ):
            raise PermissionDenied(
                "Este perfil não pode enviar documentos de verificação."
            )
        return provider

    def get_queryset(self):
        return ProviderVerificationDocument.objects.filter(
            provider=self.get_provider()
        )

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            "provider": self.get_provider(),
        }


class ProviderVerificationDocumentDeleteView(generics.DestroyAPIView):
    serializer_class = ProviderVerificationDocumentSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("delete", "head", "options")

    def get_queryset(self):
        provider = getattr(self.request.user, "provider", None)
        if provider is None:
            return ProviderVerificationDocument.objects.none()
        if provider.verification_status in (
            Provider.VerificationStatus.VERIFIED,
            Provider.VerificationStatus.SUSPENDED,
        ) or (
            provider.verification_status == Provider.VerificationStatus.PENDING
            and provider.verification_submitted_at is not None
        ):
            return ProviderVerificationDocument.objects.none()
        return ProviderVerificationDocument.objects.filter(provider=provider)

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()


class SubmitProviderVerificationView(generics.GenericAPIView):
    serializer_class = ProviderSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("post", "head", "options")

    def post(self, request):
        provider = getattr(request.user, "provider", None)
        if provider is None:
            raise PermissionDenied("Cria primeiro o perfil de prestador.")
        if not request.user.is_active:
            raise PermissionDenied("A conta está inativa.")
        if provider.verification_status in (
            Provider.VerificationStatus.VERIFIED,
            Provider.VerificationStatus.SUSPENDED,
        ):
            raise ValidationError(
                {"verification_status": "Este perfil não pode ser submetido para revisão."}
            )
        if not provider.verification_documents.exists():
            raise ValidationError(
                {"documents": "Envia pelo menos um documento para solicitar a verificação."}
            )
        if (
            provider.verification_status == Provider.VerificationStatus.PENDING
            and provider.verification_submitted_at is not None
        ):
            raise ValidationError(
                {"verification_status": "A candidatura já está em análise."}
            )

        provider.verification_status = Provider.VerificationStatus.PENDING
        provider.verification_submitted_at = timezone.now()
        provider.verification_feedback = ""
        provider.save(
            update_fields=(
                "verification_status",
                "verification_submitted_at",
                "verification_feedback",
                "updated_at",
            )
        )
        return Response(
            ProviderSerializer(provider).data,
            status=status.HTTP_200_OK,
        )


class ProviderDiscoveryView(generics.ListAPIView):
    serializer_class = ProviderDiscoverySerializer

    def get_queryset(self):
        consulta = _anotar_avaliacoes(
            Provider.objects.filter(
                verification_status=Provider.VerificationStatus.VERIFIED,
                user__is_active=True,
            )
            .select_related("business_profile")
            .annotate(
                active_service_count=Count(
                    "services",
                    filter=Q(
                        services__is_active=True,
                        services__category__is_active=True,
                    ),
                    distinct=True,
                ),
            )
            .filter(active_service_count__gt=0)
        )

        pesquisa = self.request.query_params.get("search", "").strip()
        if pesquisa:
            consulta = consulta.filter(
                Q(commercial_name__icontains=pesquisa)
                | Q(description__icontains=pesquisa)
                | Q(business_profile__registered_name__icontains=pesquisa)
                | Q(
                    services__name__icontains=pesquisa,
                    services__is_active=True,
                    services__category__is_active=True,
                )
                | Q(
                    services__description__icontains=pesquisa,
                    services__is_active=True,
                    services__category__is_active=True,
                )
            )

        id_categoria = self.request.query_params.get("category")
        if id_categoria is not None:
            if not id_categoria.isdecimal() or int(id_categoria) < 1:
                raise ValidationError(
                    {"category": "Indica um identificador de categoria válido."}
                )
            consulta = consulta.filter(
                services__category_id=int(id_categoria),
                services__is_active=True,
                services__category__is_active=True,
            )

        id_municipio = self.request.query_params.get("municipality")
        if id_municipio is not None:
            if not id_municipio.isdecimal() or int(id_municipio) < 1:
                raise ValidationError(
                    {"municipality": "Indica um identificador de município válido."}
                )
            consulta = consulta.filter(
                coverage_areas__municipality_id=int(id_municipio),
                coverage_areas__municipality__is_active=True,
                coverage_areas__municipality__province__is_active=True,
            )

        ordering = self.request.query_params.get("ordering", "name")
        ordering_fields = {
            "name": "commercial_name",
            "-name": "-commercial_name",
            "rating": "average_rating",
            "-rating": "-average_rating",
            "services": "active_service_count",
            "-services": "-active_service_count",
        }
        if ordering not in ordering_fields:
            raise ValidationError(
                {
                    "ordering": (
                        "Ordenação inválida. Usa name, -name, rating, -rating, "
                        "services ou -services."
                    )
                }
            )
        return consulta.distinct().order_by(ordering_fields[ordering], "pk")


class ProviderPublicDetailView(generics.RetrieveAPIView):
    serializer_class = ProviderDiscoverySerializer
    permission_classes = (AllowAny,)

    def get_queryset(self):
        consulta = Provider.objects.filter(
            verification_status=Provider.VerificationStatus.VERIFIED,
            user__is_active=True,
        ).select_related("business_profile").annotate(
            active_service_count=Count(
                "services",
                filter=Q(services__is_active=True, services__category__is_active=True),
                distinct=True,
            ),
        ).filter(active_service_count__gt=0)
        return _anotar_avaliacoes(consulta)
