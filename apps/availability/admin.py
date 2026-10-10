from django.contrib import admin

from .models import WeeklyAvailability


@admin.register(WeeklyAvailability)
class WeeklyAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("provider", "weekday", "start_time", "end_time", "updated_at")
    list_filter = ("weekday",)
    search_fields = ("provider__commercial_name",)
