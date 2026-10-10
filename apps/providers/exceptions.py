from rest_framework.exceptions import APIException


class ProviderConflict(APIException):
    status_code = 409
    default_detail = "Já existe um perfil de prestador associado a esta conta."
    default_code = "provider_conflict"
