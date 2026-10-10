from rest_framework import serializers

from apps.catalog.models import Service
from apps.orders.models import ServiceOrder

from .models import Proposal


class ProposalSerializer(serializers.ModelSerializer):
    provider_id = serializers.IntegerField(read_only=True)
    provider_name = serializers.CharField(
        source="provider.commercial_name",
        read_only=True,
    )
    order_id = serializers.PrimaryKeyRelatedField(
        queryset=ServiceOrder.objects.select_related("category", "municipality")
        .filter(status__in=(ServiceOrder.Status.OPEN, ServiceOrder.Status.NEGOTIATING))
        .filter(municipality__province__is_active=True)
        .exclude(category__is_active=False)
        .exclude(municipality__is_active=False),
        source="order",
    )
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    order_title = serializers.CharField(source="order.title", read_only=True)

    class Meta:
        model = Proposal
        fields = (
            "id",
            "order_id",
            "order_title",
            "provider_id",
            "provider_name",
            "service",
            "price",
            "currency",
            "description",
            "estimated_days",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "provider_id",
            "provider_name",
            "currency",
            "status",
            "created_at",
            "updated_at",
        )

    def validate(self, atributos):
        proibido = {"provider", "provider_id", "client", "client_id", "status", "currency"}
        fornecido = proibido.intersection(self.initial_data)
        if fornecido:
            raise serializers.ValidationError(
                {campo: "Este campo é gerido pelo sistema." for campo in fornecido}
            )

        prestador = getattr(self.context["request"].user, "provider", None)
        if prestador is None:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Cria primeiro o perfil de prestador para enviar propostas."
            )
        if (
            not self.context["request"].user.is_active
            or prestador.verification_status != prestador.VerificationStatus.VERIFIED
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Apenas prestadores verificados e ativos podem enviar propostas."
            )

        pedido = atributos.get("order")
        if pedido is None:
            raise serializers.ValidationError(
                {"order_id": "Indica o pedido ao qual estás a responder."}
            )
        if pedido.client_id == self.context["request"].user.pk:
            raise serializers.ValidationError(
                {"order_id": "Não podes enviar uma proposta para o teu próprio pedido."}
            )
        if pedido.status not in (
            ServiceOrder.Status.OPEN,
            ServiceOrder.Status.NEGOTIATING,
        ):
            raise serializers.ValidationError(
                {"order_id": "Este pedido já não aceita propostas."}
            )
        if not pedido.category.is_active or not pedido.municipality.is_active:
            raise serializers.ValidationError(
                {"order_id": "Este pedido já não está disponível."}
            )

        servico = atributos.get("service")
        if servico is not None:
            if servico.provider_id != prestador.pk:
                raise serializers.ValidationError(
                    {"service": "Só podes incluir um serviço teu na proposta."}
                )
            if servico.category_id != pedido.category_id:
                raise serializers.ValidationError(
                    {"service": "O serviço não pertence à categoria do pedido."}
                )

        if Proposal.objects.filter(order=pedido, provider=prestador).exists():
            raise serializers.ValidationError(
                {"order_id": "Já enviaste uma proposta para este pedido."}
            )

        atributos["order"] = pedido
        return atributos

    def validate_estimated_days(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "O prazo estimado deve ser de pelo menos um dia."
            )
        return value

    def create(self, dados_validados):
        from .services import criar_proposta

        prestador = self.context["request"].user.provider
        return criar_proposta(provider=prestador, **dados_validados)
