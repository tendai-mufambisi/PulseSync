import re
from rest_framework import serializers
from .models import Patient, ClinicalRecord, HealthEvent, RegistrationType
from apps.accounts.models import Role

REDACTED = '[REDACTED]'
_ZIM_ID_RE = re.compile(r'^\d{2}-\d{7}[A-Za-z]\d{2}$')


# ---------------------------------------------------------------------------
# Health Event serializer (the timeline backbone)
# ---------------------------------------------------------------------------

class HealthEventSerializer(serializers.ModelSerializer):
    clinician_name = serializers.SerializerMethodField()
    hospital_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = HealthEvent
        fields = (
            'id', 'patient', 'event_type', 'event_date',
            'hospital', 'hospital_name', 'clinician', 'clinician_name',
            'summary', 'is_sensitive', 'sensitive_category',
            # Birth-specific
            'birth_weight_kg', 'delivery_type', 'gestational_age_weeks',
            'birth_complications', 'apgar_score', 'initial_observations',
            # Clinical
            'diagnosis', 'medications', 'notes',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'patient', 'clinician', 'clinician_name',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        )

    def get_clinician_name(self, obj):
        return obj.clinician.full_name if obj.clinician else None

    def get_hospital_name(self, obj):
        return obj.hospital.name if obj.hospital else None

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    def validate(self, data):
        event_type = data.get('event_type')
        # Sensitive type always sets the flag
        if event_type == HealthEvent.EventType.SENSITIVE:
            data['is_sensitive'] = True
        # Sensitive category only makes sense on sensitive events
        if data.get('sensitive_category') and event_type != HealthEvent.EventType.SENSITIVE:
            raise serializers.ValidationError(
                {'sensitive_category': 'Only applicable to sensitive event types.'}
            )
        return data


# ---------------------------------------------------------------------------
# Patient creation — type-aware, handles both registration paths
# ---------------------------------------------------------------------------

class PatientCreateSerializer(serializers.ModelSerializer):
    # Extra write-only fields for the birth health event (newborn path only)
    birth_weight_kg = serializers.DecimalField(
        max_digits=5, decimal_places=3, required=False, allow_null=True, write_only=True,
    )
    delivery_type = serializers.ChoiceField(
        choices=HealthEvent.DeliveryType.choices, required=False, allow_blank=True, write_only=True,
    )
    gestational_age_weeks = serializers.IntegerField(
        required=False, allow_null=True, min_value=20, max_value=45, write_only=True,
    )
    birth_complications = serializers.CharField(
        required=False, allow_blank=True, write_only=True,
    )
    apgar_score = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=10, write_only=True,
    )
    initial_observations = serializers.CharField(
        required=False, allow_blank=True, write_only=True,
    )

    class Meta:
        model = Patient
        fields = (
            'registration_type',
            'national_id',
            'full_name', 'date_of_birth', 'gender', 'blood_type',
            # Medical baseline
            'allergies', 'critical_conditions', 'chronic_conditions',
            'past_surgeries', 'existing_medications', 'hiv_status', 'notes',
            # Guardian (newborn / minor)
            'guardian_name', 'guardian_relationship',
            'guardian_national_id', 'guardian_contact',
            # Emergency contacts
            'emergency_contact',
            'next_of_kin_name', 'next_of_kin_relationship',
            'next_of_kin_phone', 'next_of_kin_alt_phone',
            'emergency_contact_2_name', 'emergency_contact_2_phone',
            'emergency_contact_3_name', 'emergency_contact_3_phone',
            # Birth event fields (write-only, not stored on Patient)
            'birth_weight_kg', 'delivery_type', 'gestational_age_weeks',
            'birth_complications', 'apgar_score', 'initial_observations',
        )

    def validate_national_id(self, value):
        if not value:
            return value
        if not _ZIM_ID_RE.match(value):
            raise serializers.ValidationError(
                'National ID must be in format DD-NNNNNNNLCC (e.g. 63-2400679R42): '
                '2-digit district code, 7-digit serial number, 1 letter, 2-digit code.'
            )
        return value[:-3] + value[-3].upper() + value[-2:]

    def validate(self, data):
        reg_type = data.get('registration_type', RegistrationType.EXISTING)
        if reg_type == RegistrationType.EXISTING and not data.get('national_id'):
            raise serializers.ValidationError(
                {'national_id': 'National ID is required for existing person registration.'}
            )
        if reg_type == RegistrationType.NEWBORN and not data.get('guardian_name'):
            raise serializers.ValidationError(
                {'guardian_name': 'Guardian name is required for newborn registration.'}
            )
        return data

    def create(self, validated_data):
        # Extract birth event fields — they are not Patient model fields
        birth_event_kwargs = {
            'birth_weight_kg': validated_data.pop('birth_weight_kg', None),
            'delivery_type': validated_data.pop('delivery_type', '') or '',
            'gestational_age_weeks': validated_data.pop('gestational_age_weeks', None),
            'birth_complications': validated_data.pop('birth_complications', '') or '',
            'apgar_score': validated_data.pop('apgar_score', None),
            'initial_observations': validated_data.pop('initial_observations', '') or '',
        }

        patient = Patient.objects.create(**validated_data)

        if patient.registration_type == RegistrationType.NEWBORN:
            hospital = patient.hospital
            HealthEvent.objects.create(
                patient=patient,
                event_type=HealthEvent.EventType.BIRTH,
                event_date=patient.date_of_birth,
                hospital=hospital,
                clinician=patient.created_by,
                created_by=patient.created_by,
                summary=(
                    f"Birth registration at {hospital.name if hospital else 'facility'}"
                ),
                **birth_event_kwargs,
            )

        return patient


# ---------------------------------------------------------------------------
# Patient read serializers
# ---------------------------------------------------------------------------

class PatientSerializer(serializers.ModelSerializer):
    health_events = HealthEventSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = (
            'id', 'registration_type',
            'national_id', 'full_name', 'date_of_birth', 'gender', 'blood_type',
            # Medical baseline
            'allergies', 'critical_conditions', 'chronic_conditions',
            'past_surgeries', 'existing_medications', 'hiv_status', 'notes',
            # Guardian
            'guardian_name', 'guardian_relationship',
            'guardian_national_id', 'guardian_contact',
            # Emergency contacts
            'emergency_contact',
            'next_of_kin_name', 'next_of_kin_relationship',
            'next_of_kin_phone', 'next_of_kin_alt_phone',
            'emergency_contact_2_name', 'emergency_contact_2_phone',
            'emergency_contact_3_name', 'emergency_contact_3_phone',
            'created_by', 'created_by_name',
            'health_events', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'registration_type', 'created_by', 'created_by_name', 'created_at', 'updated_at')

    def validate_national_id(self, value):
        if not value:
            return value
        if not _ZIM_ID_RE.match(value):
            raise serializers.ValidationError(
                'National ID must be in format DD-NNNNNNNLCC (e.g. 63-2400679R42).'
            )
        return value[:-3] + value[-3].upper() + value[-2:]

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        role = getattr(getattr(request, 'user', None), 'role', None)
        if role == Role.NURSE:
            data['hiv_status'] = REDACTED
            # Strip sensitive events from inline list for nurses
            data['health_events'] = [e for e in data['health_events'] if not e.get('is_sensitive')]
        return data


class PatientListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = (
            'id', 'registration_type', 'national_id', 'full_name',
            'date_of_birth', 'gender', 'blood_type', 'created_at',
        )


class ParamedicPatientSerializer(serializers.ModelSerializer):
    """Read-only emergency view for paramedics — no clinical or sensitive fields."""

    class Meta:
        model = Patient
        fields = (
            'id', 'full_name', 'date_of_birth', 'blood_type',
            'allergies', 'critical_conditions', 'chronic_conditions',
            'next_of_kin_name', 'next_of_kin_relationship',
            'next_of_kin_phone', 'next_of_kin_alt_phone',
            'emergency_contact',
            'emergency_contact_2_name', 'emergency_contact_2_phone',
            'emergency_contact_3_name', 'emergency_contact_3_phone',
        )


# ---------------------------------------------------------------------------
# Legacy ClinicalRecord serializer (backward compat — old /records endpoint)
# ---------------------------------------------------------------------------

class ClinicalRecordSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ClinicalRecord
        fields = ('id', 'patient', 'diagnosis', 'medications', 'notes',
                  'author', 'author_name', 'date', 'created_at')
        read_only_fields = ('id', 'author', 'author_name', 'date', 'created_at', 'patient')

    def get_author_name(self, obj):
        return obj.author.full_name if obj.author else None
