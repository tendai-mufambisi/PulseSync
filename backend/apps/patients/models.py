import uuid
from django.db import models
from django.core.validators import RegexValidator
from apps.accounts.models import User

zim_id_validator = RegexValidator(
    regex=r'^\d{2}-\d{7}[A-Z]\d{2}$',
    message='Enter a valid Zimbabwe national ID (e.g. 63-2400679R42).',
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


class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    national_id = models.CharField(max_length=20, unique=True, db_index=True, validators=[zim_id_validator])
    full_name = models.CharField(max_length=255)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=Gender.choices)
    blood_type = models.CharField(max_length=10, choices=BloodType.choices, default=BloodType.UNKNOWN)
    allergies = models.TextField(blank=True)
    critical_conditions = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=255, blank=True)
    hiv_status = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
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
        return f"{self.full_name} ({self.national_id})"


class ClinicalRecord(models.Model):
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
