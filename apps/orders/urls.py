from rest_framework.routers import DefaultRouter

from .views import ServiceOrderViewSet

router = DefaultRouter()
router.register("", ServiceOrderViewSet, basename="order")

urlpatterns = router.urls
