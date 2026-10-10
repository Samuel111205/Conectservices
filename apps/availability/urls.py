from rest_framework.routers import SimpleRouter

from .views import WeeklyAvailabilityViewSet

router = SimpleRouter()
router.register("", WeeklyAvailabilityViewSet, basename="availability")

urlpatterns = router.urls
