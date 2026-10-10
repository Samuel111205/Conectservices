from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.orders.models import ServiceOrder
from apps.providers.models import Provider

from .models import Proposal
from .serializers import ProposalSerializer
from .services import cancelar_proposta, rejeitar_proposta


class ProposalViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProposalSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Proposal.objects.none()
        consulta = Proposal.objects.select_related(
            "order",
            "provider",
            "provider__user",
            "service",
        )
        if self.action == "list":
            prestador = getattr(self.request.user, "provider", None)
            if prestador is not None:
                return consulta.filter(
                    Q(provider=prestador) | Q(order__client=self.request.user)
                ).distinct()
            return consulta.filter(order__client=self.request.user)
        if self.action == "retrieve":
            prestador = getattr(self.request.user, "provider", None)
            if prestador is None:
                return consulta.filter(order__client=self.request.user)
            return consulta.filter(
                Q(provider=prestador) | Q(order__client=self.request.user)
            ).distinct()
        return consulta.none()

    def get_serializer_class(self):
        return ProposalSerializer

    def perform_create(self, serializer):
        prestador = getattr(self.request.user, "provider", None)
        if prestador is None:
            raise PermissionDenied(
                "Cria primeiro o perfil de prestador para enviar propostas."
            )
        if (
            not self.request.user.is_active
            or prestador.verification_status != Provider.VerificationStatus.VERIFIED
        ):
            raise PermissionDenied(
                "Apenas prestadores verificados e ativos podem enviar propostas."
            )
        serializer.save()

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        proposta = cancelar_proposta(proposal_id=pk, actor=request.user)
        return Response(self.get_serializer(proposta).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        proposta = rejeitar_proposta(proposal_id=pk, actor=request.user)
        return Response(self.get_serializer(proposta).data)

    @action(detail=True, methods=("post",))
    def accept(self, request, pk=None):
        from apps.bookings.services import aceitar_proposta

        contratacao = aceitar_proposta(proposal_id=pk, actor=request.user)
        from apps.bookings.serializers import BookingSerializer

        return Response(
            BookingSerializer(contratacao, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
