from rest_framework.routers import SimpleRouter

from .views import FavoriteProviderViewSet, FavoriteServiceViewSet

router = SimpleRouter()
router.register("providers", FavoriteProviderViewSet, basename="favorite-provider")
router.register("services", FavoriteServiceViewSet, basename="favorite-service")

urlpatterns = router.urls
