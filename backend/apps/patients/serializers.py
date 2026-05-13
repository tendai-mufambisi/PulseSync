import re
from rest_framework import serializers
from .models import Patient, ClinicalRecord
from apps.accounts.models import Role

REDACTED = '[REDACTED]'
_ZIM_ID_RE = re.compile(r'^\d{2}-\d{7}[A-Za-z]\d{2}$')


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
            'blood_type', 'allergies', 'critical_conditions', 'chronic_conditions',
            'emergency_contact',
            # next of kin
            'next_of_kin_name', 'next_of_kin_relationship',
            'next_of_kin_phone', 'next_of_kin_alt_phone',
            # additional emergency contacts
            'emergency_contact_2_name', 'emergency_contact_2_phone',
            'emergency_contact_3_name', 'emergency_contact_3_phone',
            'hiv_status', 'notes', 'created_by', 'created_by_name',
            'records', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'created_by_name', 'created_at', 'updated_at')

    def validate_national_id(self, value):
        if not _ZIM_ID_RE.match(value):
            raise serializers.ValidationError(
                'National ID must be in format DD-NNNNNNNLCC (e.g. 63-2400679R42): '
                '2-digit district code, 7-digit serial number, 1 letter, 2-digit code.'
            )
        # Normalise the letter to uppercase
        return value[:-3] + value[-3].upper() + value[-2:]

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
