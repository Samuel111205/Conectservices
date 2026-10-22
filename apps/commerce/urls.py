from rest_framework.routers import DefaultRouter

from .views import ProductOrderViewSet, ProductViewSet

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("product-orders", ProductOrderViewSet, basename="product-order")

urlpatterns = router.urls
