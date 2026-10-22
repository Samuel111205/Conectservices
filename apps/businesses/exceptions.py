from rest_framework.exceptions import APIException


class BusinessProfileConflict(APIException):
    status_code = 409
    default_detail = "Esta conta já possui um perfil empresarial."
    default_code = "business_profile_conflict"
