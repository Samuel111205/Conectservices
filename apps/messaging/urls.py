from rest_framework.routers import SimpleRouter

from .views import ConversationViewSet, NotificationViewSet

router = SimpleRouter()
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
