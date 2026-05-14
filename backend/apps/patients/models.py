import uuid
from django.db import models
from django.core.validators import RegexValidator
from apps.accounts.models import User

zim_id_validator = RegexValidator(
    regex=r'^\d{2}-\d{7}[A-Za-z]\d{2}$',
    message='National ID must be in format DD-NNNNNNNLCC (e.g. 63-2400679R42).',
)


class Gender(models.TextChoices):
    MALE = 'male', 'Male'
    FEMALE = 'female', 'Female'
    OTHER = 'other', 'Other'


class BloodType(models.TextChoices):
    A_POS = 'A+', 'A+'
    A_NEG = 'A-', 'A-'
    B_POS = 'B+', 'B+'
    B_NEG = 'B-', 'B-'
    AB_POS = 'AB+', 'AB+'
    AB_NEG = 'AB-', 'AB-'
    O_POS = 'O+', 'O+'
    O_NEG = 'O-', 'O-'
    UNKNOWN = 'unknown', 'Unknown'


class RegistrationType(models.TextChoices):
    NEWBORN = 'newborn', 'Newborn'
    EXISTING = 'existing', 'Existing Person'


class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    registration_type = models.CharField(
        max_length=10, choices=RegistrationType.choices, default=RegistrationType.EXISTING
    )

    # National ID is optional for newborns (they don't have one at birth)
    national_id = models.CharField(
        max_length=20, unique=True, null=True, blank=True,
        db_index=True, validators=[zim_id_validator],
    )

    full_name = models.CharField(max_length=255)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=Gender.choices)
    blood_type = models.CharField(max_length=10, choices=BloodType.choices, default=BloodType.UNKNOWN)

    # Medical baseline (historical summary for existing-person registration)
    allergies = models.TextField(blank=True)
    critical_conditions = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    past_surgeries = models.TextField(blank=True)
    existing_medications = models.TextField(blank=True)
    hiv_status = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)

    # Guardian / parent info — required for newborns, useful for minors
    guardian_name = models.CharField(max_length=200, blank=True)
    guardian_relationship = models.CharField(max_length=100, blank=True)
    guardian_national_id = models.CharField(max_length=20, blank=True)
    guardian_contact = models.CharField(max_length=50, blank=True)

    # Emergency contacts
    emergency_contact = models.CharField(max_length=255, blank=True)
    next_of_kin_name = models.CharField(max_length=150, blank=True)
    next_of_kin_relationship = models.CharField(max_length=100, blank=True)
    next_of_kin_phone = models.CharField(max_length=20, blank=True)
    next_of_kin_alt_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_2_name = models.CharField(max_length=150, blank=True)
    emergency_contact_2_phone = models.CharField(max_length=20, blank=True)
    emergency_contact_3_name = models.CharField(max_length=150, blank=True)
    emergency_contact_3_phone = models.CharField(max_length=20, blank=True)

    hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='patients',
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='registered_patients',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.national_id or 'no ID'})"


class HealthEvent(models.Model):
    """A single structured event on a patient's longitudinal health timeline."""

    class EventType(models.TextChoices):
        BIRTH = 'birth', 'Birth Record'
        CONSULTATION = 'consultation', 'Consultation'
        DIAGNOSIS = 'diagnosis', 'Diagnosis'
        MEDICATION = 'medication', 'Medication'
        EMERGENCY = 'emergency', 'Emergency'
        SENSITIVE = 'sensitive', 'Sensitive Clinical Record'

    class DeliveryType(models.TextChoices):
        NORMAL = 'normal', 'Normal Vaginal Delivery'
        CESAREAN = 'cesarean', 'Cesarean Section'
        ASSISTED = 'assisted', 'Assisted Delivery'

    class SensitiveCategory(models.TextChoices):
        HIV = 'hiv', 'HIV/AIDS'
        REPRODUCTIVE = 'reproductive', 'Reproductive Health'
        MENTAL_HEALTH = 'mental_health', 'Mental Health'
        SUBSTANCE = 'substance', 'Substance Use'
        OTHER = 'other', 'Other Sensitive'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='health_events')
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    event_date = models.DateField()

    hospital = models.ForeignKey(
        'hospitals.Hospital', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='health_events',
    )
    clinician = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='authored_events',
    )

    summary = models.TextField(blank=True)
    is_sensitive = models.BooleanField(default=False)
    sensitive_category = models.CharField(
        max_length=20, choices=SensitiveCategory.choices, blank=True
    )

    # Birth-specific fields
    birth_weight_kg = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    delivery_type = models.CharField(max_length=20, choices=DeliveryType.choices, blank=True)
    gestational_age_weeks = models.PositiveSmallIntegerField(null=True, blank=True)
    birth_complications = models.TextField(blank=True)
    apgar_score = models.PositiveSmallIntegerField(null=True, blank=True)
    initial_observations = models.TextField(blank=True)

    # Clinical fields (consultation, diagnosis, medication, emergency, sensitive)
    diagnosis = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_health_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-event_date', '-created_at']

    def __str__(self):
        return f"{self.get_event_type_display()} for {self.patient} on {self.event_date}"


class ClinicalRecord(models.Model):
    """Legacy model kept for backward compatibility. New code uses HealthEvent."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='records')
    diagnosis = models.TextField()
    medications = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    author = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='clinical_records',
    )
    date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"Record for {self.patient} on {self.date}"
