from rest_framework import serializers

from .models import ListingView


class ListingViewSerializer(serializers.Serializer):
    listing_type = serializers.ChoiceField(choices=ListingView.ListingType.choices)
    listing_id = serializers.IntegerField(min_value=1)
    session_key = serializers.UUIDField()
