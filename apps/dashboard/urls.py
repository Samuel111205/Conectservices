from django.urls import path

from .views import AdminDashboardView, AnalyticsView, DashboardView, ListingViewEventView

urlpatterns = [
    path("", DashboardView.as_view(), name="dashboard"),
    path("analytics/", AnalyticsView.as_view(), name="dashboard-analytics"),
    path("admin/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("analytics/views/", ListingViewEventView.as_view(), name="listing-view-event"),
]
