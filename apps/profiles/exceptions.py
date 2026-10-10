from rest_framework.exceptions import APIException


class ProfileConflict(APIException):
    status_code = 409
    default_detail = "Já existe um perfil associado a esta conta."
    default_code = "profile_conflict"
