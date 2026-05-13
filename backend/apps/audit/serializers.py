from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    hospital_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            'id', 'user', 'user_email', 'user_role', 'patient', 'patient_name',
            'hospital', 'hospital_name', 'action', 'category', 'severity',
            'timestamp', 'ip_address',
        )

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def get_user_role(self, obj):
        return obj.user.role if obj.user else None

    def get_patient_name(self, obj):
        return obj.patient.full_name if obj.patient else None

    def get_hospital_name(self, obj):
        return obj.hospital.name if obj.hospital else None
