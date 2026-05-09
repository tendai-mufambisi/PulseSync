from rest_framework import serializers
from .models import Hospital


class HospitalSerializer(serializers.ModelSerializer):
    staff_count = serializers.SerializerMethodField()

    class Meta:
        model = Hospital
        fields = ('id', 'name', 'location', 'phone', 'staff_count', 'created_at')
        read_only_fields = ('id', 'staff_count', 'created_at')

    def get_staff_count(self, obj):
        return obj.staff.count()
