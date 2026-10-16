from rest_framework.routers import SimpleRouter

from .views import ConversationViewSet, NotificationViewSet, PushDeviceTokenViewSet

router = SimpleRouter()
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("push-tokens", PushDeviceTokenViewSet, basename="push-token")

urlpatterns = router.urls
