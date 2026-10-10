from rest_framework import serializers

from .models import Municipality, Province, ProviderCoverage, UserLocation


class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ("id", "name", "code", "is_active")
        read_only_fields = ("id",)

    def validate_name(self, value):
        return value.strip()

    def validate_code(self, value):
        return value.strip().upper()

    def validate(self, atributos):
        requisicao = self.context.get("request")
        if not requisicao or not requisicao.user.is_staff:
            proibido = {"is_active"}.intersection(self.initial_data)
            if proibido:
                raise serializers.ValidationError(
                    {"is_active": "Apenas administradores podem alterar este campo."}
                )
        is_active = atributos.get(
            "is_active",
            self.instance.is_active if self.instance is not None else True,
        )
        if (
            self.instance is not None
            and not is_active
            and self.instance.municipalities.filter(is_active=True).exists()
        ):
            raise serializers.ValidationError(
                {"is_active": "Desative primeiro os municípios ativos."}
            )
        return atributos


class MunicipalitySerializer(serializers.ModelSerializer):
    province_name = serializers.CharField(source="province.name", read_only=True)

    class Meta:
        model = Municipality
        fields = ("id", "province", "province_name", "name", "is_active")
        read_only_fields = ("id", "province_name")

    def validate_name(self, value):
        return value.strip()

    def validate(self, atributos):
        requisicao = self.context.get("request")
        if not requisicao or not requisicao.user.is_staff:
            proibido = {"province", "province_id", "is_active"}
            fornecido = proibido.intersection(self.initial_data)
            if fornecido:
                raise serializers.ValidationError(
                    {
                        campo: "Apenas administradores podem alterar este campo."
                        for campo in fornecido
                    }
                )
        provincia = atributos.get(
            "province",
            self.instance.province if self.instance is not None else None,
        )
        is_active = atributos.get(
            "is_active",
            self.instance.is_active if self.instance is not None else True,
        )
        if provincia is not None and not provincia.is_active and is_active:
            raise serializers.ValidationError(
                {"province": "O município não pode estar ativo numa província inativa."}
            )
        return atributos


class UserLocationSerializer(serializers.ModelSerializer):
    municipality_name = serializers.CharField(
        source="municipality.name",
        read_only=True,
    )
    province_name = serializers.CharField(
        source="municipality.province.name",
        read_only=True,
    )
    municipality = serializers.PrimaryKeyRelatedField(
        queryset=Municipality.objects.filter(is_active=True, province__is_active=True)
    )

    class Meta:
        model = UserLocation
        fields = (
            "id",
            "municipality",
            "municipality_name",
            "province_name",
            "label",
            "neighborhood",
            "address",
            "latitude",
            "longitude",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "municipality_name",
            "province_name",
            "created_at",
            "updated_at",
        )

    def validate(self, atributos):
        municipio = atributos.get(
            "municipality",
            self.instance.municipality if self.instance is not None else None,
        )
        is_active = atributos.get(
            "is_active",
            self.instance.is_active if self.instance is not None else True,
        )
        if is_active and municipio is not None:
            if not municipio.is_active or not municipio.province.is_active:
                raise serializers.ValidationError(
                    {
                        "municipality": (
                            "Uma localização ativa tem de pertencer a um município "
                            "e província ativos."
                        )
                    }
                )

        latitude = atributos.get(
            "latitude",
            self.instance.latitude if self.instance is not None else None,
        )
        longitude = atributos.get(
            "longitude",
            self.instance.longitude if self.instance is not None else None,
        )
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                {
                    "coordinates": (
                        "Latitude e longitude devem ser fornecidas em conjunto."
                    )
                }
            )
        return atributos


class ProviderCoverageSerializer(serializers.ModelSerializer):
    provider_id = serializers.IntegerField(read_only=True)
    provider_name = serializers.CharField(
        source="provider.commercial_name",
        read_only=True,
    )
    municipality_name = serializers.CharField(
        source="municipality.name",
        read_only=True,
    )
    province_name = serializers.CharField(
        source="municipality.province.name",
        read_only=True,
    )
    municipality = serializers.PrimaryKeyRelatedField(
        queryset=Municipality.objects.filter(is_active=True, province__is_active=True)
    )

    class Meta:
        model = ProviderCoverage
        fields = (
            "id",
            "provider_id",
            "provider_name",
            "municipality",
            "municipality_name",
            "province_name",
            "radius_km",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "provider_id",
            "provider_name",
            "municipality_name",
            "province_name",
            "created_at",
            "updated_at",
        )

    def validate(self, atributos):
        if {"provider", "provider_id"}.intersection(self.initial_data):
            raise serializers.ValidationError(
                {"provider": "O prestador é definido pela conta autenticada."}
            )
        prestador = getattr(self.context["request"].user, "provider", None)
        if prestador is None:
            return atributos
        municipio = atributos.get(
            "municipality",
            self.instance.municipality if self.instance is not None else None,
        )
        if municipio is not None:
            existing = ProviderCoverage.objects.filter(
                provider=prestador,
                municipality=municipio,
            )
            if self.instance is not None:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {"municipality": "Já existe uma área para este município."}
                )
        return atributos
