from rest_framework.routers import DefaultRouter

from .views import (
    MunicipalityViewSet,
    ProviderCoverageViewSet,
    ProvinceViewSet,
    UserLocationViewSet,
)

router = DefaultRouter()
router.register("provinces", ProvinceViewSet, basename="province")
router.register("municipalities", MunicipalityViewSet, basename="municipality")
router.register("locations", UserLocationViewSet, basename="user-location")
router.register("provider-coverage", ProviderCoverageViewSet, basename="provider-coverage")

urlpatterns = router.urls
