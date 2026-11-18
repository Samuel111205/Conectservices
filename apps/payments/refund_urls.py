from rest_framework.routers import SimpleRouter

from .refund_views import RefundRequestViewSet

router = SimpleRouter()
router.register("", RefundRequestViewSet, basename="refund-request")

urlpatterns = router.urls
