from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'user_email', 'patient', 'patient_name',
                  'action', 'timestamp', 'ip_address')

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def get_patient_name(self, obj):
        return obj.patient.full_name if obj.patient else None
