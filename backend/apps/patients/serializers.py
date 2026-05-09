from rest_framework import serializers
from .models import Patient, ClinicalRecord
from apps.accounts.models import Role

REDACTED = '[REDACTED]'


class ClinicalRecordSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ClinicalRecord
        fields = ('id', 'patient', 'diagnosis', 'medications', 'notes',
                  'author', 'author_name', 'date', 'created_at')
        read_only_fields = ('id', 'author', 'author_name', 'date', 'created_at', 'patient')

    def get_author_name(self, obj):
        return obj.author.full_name if obj.author else None


class PatientSerializer(serializers.ModelSerializer):
    records = ClinicalRecordSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = (
            'id', 'national_id', 'full_name', 'date_of_birth', 'gender',
            'blood_type', 'allergies', 'critical_conditions', 'emergency_contact',
            'hiv_status', 'notes', 'created_by', 'created_by_name',
            'records', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'created_by_name', 'created_at', 'updated_at')

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == Role.NURSE:
            data['hiv_status'] = REDACTED
        return data


class PatientListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ('id', 'national_id', 'full_name', 'date_of_birth', 'gender',
                  'blood_type', 'created_at')
