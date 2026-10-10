from rest_framework.throttling import ScopedRateThrottle


class RegistrationThrottle(ScopedRateThrottle):
    scope = "auth_register"


class LoginThrottle(ScopedRateThrottle):
    scope = "auth_login"
