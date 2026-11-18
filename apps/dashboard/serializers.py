from rest_framework import serializers

from .models import ListingView


class ListingViewSerializer(serializers.Serializer):
    listing_type = serializers.ChoiceField(choices=ListingView.ListingType.choices)
    listing_id = serializers.IntegerField(min_value=1)
    session_key = serializers.UUIDField()


class ClientDashboardSerializer(serializers.Serializer):
    orders_by_status = serializers.DictField(child=serializers.IntegerField())
    proposals_received_by_status = serializers.DictField(
        child=serializers.IntegerField()
    )
    bookings_by_status = serializers.DictField(child=serializers.IntegerField())
    payments_by_status = serializers.DictField(child=serializers.IntegerField())


class ProviderServiceCountsSerializer(serializers.Serializer):
    active = serializers.IntegerField()
    inactive = serializers.IntegerField()


class ProviderReviewCountsSerializer(serializers.Serializer):
    average_rating = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()


class ProviderDashboardSerializer(serializers.Serializer):
    services = ProviderServiceCountsSerializer()
    proposals_by_status = serializers.DictField(child=serializers.IntegerField())
    bookings_by_status = serializers.DictField(child=serializers.IntegerField())
    reviews = ProviderReviewCountsSerializer()
    completed_booking_value = serializers.CharField()
    confirmed_payments_total = serializers.CharField()
    currency = serializers.CharField()


class PlatformDashboardSerializer(serializers.Serializer):
    users_total = serializers.IntegerField()
    providers_by_verification_status = serializers.DictField(
        child=serializers.IntegerField()
    )
    orders_by_status = serializers.DictField(child=serializers.IntegerField())
    bookings_by_status = serializers.DictField(child=serializers.IntegerField())
    payments_by_status = serializers.DictField(child=serializers.IntegerField())


class DashboardResponseSerializer(serializers.Serializer):
    client = ClientDashboardSerializer()
    provider = ProviderDashboardSerializer(allow_null=True)
    platform = PlatformDashboardSerializer(allow_null=True)


class ProfessionalAnalyticsSummarySerializer(serializers.Serializer):
    views = serializers.IntegerField()
    publications = serializers.IntegerField()
    service_orders = serializers.IntegerField()
    proposals = serializers.IntegerField()
    conversations = serializers.IntegerField()
    product_orders = serializers.IntegerField()


class ProfessionalAnalyticsSeriesSerializer(serializers.Serializer):
    date = serializers.DateField()
    views = serializers.IntegerField()
    publications = serializers.IntegerField()
    service_orders = serializers.IntegerField()
    proposals = serializers.IntegerField()
    conversations = serializers.IntegerField()
    product_orders = serializers.IntegerField()


class ProfessionalAnalyticsResponseSerializer(serializers.Serializer):
    period_days = serializers.IntegerField()
    publications_total = serializers.IntegerField()
    summary = ProfessionalAnalyticsSummarySerializer()
    series = ProfessionalAnalyticsSeriesSerializer(many=True)


class AdminDashboardSummarySerializer(serializers.Serializer):
    users_total = serializers.IntegerField()
    businesses_total = serializers.IntegerField()
    providers_total = serializers.IntegerField()
    services_total = serializers.IntegerField()
    products_total = serializers.IntegerField()
    publications_total = serializers.IntegerField()
    service_orders_total = serializers.IntegerField()
    product_orders_total = serializers.IntegerField()
    conversations_total = serializers.IntegerField()
    views_total = serializers.IntegerField()
    new_users_30d = serializers.IntegerField()
    verifications_pending = serializers.IntegerField()
    business_verifications_pending = serializers.IntegerField()
    inactive_services = serializers.IntegerField()


class AdminAnalyticsSummarySerializer(serializers.Serializer):
    registrations = serializers.IntegerField()
    publications = serializers.IntegerField()
    service_orders = serializers.IntegerField()
    product_orders = serializers.IntegerField()
    conversations = serializers.IntegerField()
    views = serializers.IntegerField()


class AdminAnalyticsSeriesSerializer(serializers.Serializer):
    date = serializers.DateField()
    registrations = serializers.IntegerField()
    publications = serializers.IntegerField()
    service_orders = serializers.IntegerField()
    product_orders = serializers.IntegerField()
    conversations = serializers.IntegerField()
    views = serializers.IntegerField()
    registrations_average_7d = serializers.FloatField(allow_null=True)
    publications_average_7d = serializers.FloatField(allow_null=True)
    service_orders_average_7d = serializers.FloatField(allow_null=True)
    product_orders_average_7d = serializers.FloatField(allow_null=True)
    conversations_average_7d = serializers.FloatField(allow_null=True)
    views_average_7d = serializers.FloatField(allow_null=True)


class AdminAnalyticsMetricSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    daily_average = serializers.FloatField()
    daily_standard_deviation = serializers.FloatField(allow_null=True)
    active_days = serializers.IntegerField()
    zero_days = serializers.IntegerField()
    trend_per_day = serializers.FloatField()
    trend_direction = serializers.ChoiceField(
        choices=("increasing", "decreasing", "stable")
    )
    r_squared = serializers.FloatField(allow_null=True)


class AdminAnalyticsAnalysisSerializer(serializers.Serializer):
    method = serializers.CharField()
    rolling_window_days = serializers.IntegerField()
    metrics = serializers.DictField(child=AdminAnalyticsMetricSerializer())


class AdminAnalyticsSerializer(serializers.Serializer):
    period_days = serializers.IntegerField()
    summary = AdminAnalyticsSummarySerializer()
    series = AdminAnalyticsSeriesSerializer(many=True)
    analysis = AdminAnalyticsAnalysisSerializer()


class PeriodComparisonMetricSerializer(serializers.Serializer):
    current = serializers.IntegerField()
    previous = serializers.IntegerField()
    change = serializers.IntegerField()
    change_percent = serializers.FloatField(allow_null=True)


class PeriodComparisonSerializer(serializers.Serializer):
    period_days = serializers.IntegerField()
    current_start = serializers.DateField()
    current_end = serializers.DateField()
    previous_start = serializers.DateField()
    previous_end = serializers.DateField()
    metrics = serializers.DictField(child=PeriodComparisonMetricSerializer())


class ServiceOrderFunnelStageSerializer(serializers.Serializer):
    key = serializers.CharField()
    name = serializers.CharField()
    count = serializers.IntegerField()
    conversion_from_previous = serializers.FloatField(allow_null=True)


class ServiceOrderFunnelSerializer(serializers.Serializer):
    cohort_start = serializers.DateField()
    cohort_end = serializers.DateField()
    stages = ServiceOrderFunnelStageSerializer(many=True)


class UserGrowthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    users = serializers.IntegerField()


class BusinessGrowthPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    businesses = serializers.IntegerField()


class CategoryDistributionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    total = serializers.IntegerField()
    percentage = serializers.IntegerField()


class RecentUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    created_at = serializers.DateTimeField()
    active = serializers.BooleanField()
    staff = serializers.BooleanField()


class PendingVerificationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    submitted_at = serializers.DateTimeField()


class PendingBusinessSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    registered_name = serializers.CharField()
    email = serializers.EmailField()
    submitted_at = serializers.DateTimeField()


class InactiveServiceSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    provider_name = serializers.CharField()
    created_at = serializers.DateTimeField()


class VerificationActivitySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    provider_name = serializers.CharField()
    previous_status = serializers.CharField(allow_null=True)
    new_status = serializers.CharField()
    actor = serializers.EmailField(allow_null=True)
    created_at = serializers.DateTimeField()


class AdminDashboardResponseSerializer(serializers.Serializer):
    summary = AdminDashboardSummarySerializer()
    analytics = AdminAnalyticsSerializer()
    period_comparison = PeriodComparisonSerializer()
    service_order_funnel = ServiceOrderFunnelSerializer()
    user_growth = UserGrowthPointSerializer(many=True)
    business_growth = BusinessGrowthPointSerializer(many=True)
    services_by_category = CategoryDistributionSerializer(many=True)
    recent_users = RecentUserSerializer(many=True)
    pending_verifications = PendingVerificationSerializer(many=True)
    pending_businesses = PendingBusinessSerializer(many=True)
    inactive_services = InactiveServiceSerializer(many=True)
    recent_activity = VerificationActivitySerializer(many=True)
    reports_available = serializers.BooleanField()
