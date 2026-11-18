from rest_framework.routers import DefaultRouter

from .dispute_views import DisputeViewSet

router = DefaultRouter()
router.register("", DisputeViewSet, basename="dispute")

urlpatterns = router.urls
