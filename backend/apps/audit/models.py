from django.db import models
from apps.accounts.models import User


class Severity(models.TextChoices):
    INFO = 'info', 'Info'
    WARNING = 'warning', 'Warning'
    CRITICAL = 'critical', 'Critical'


class Category(models.TextChoices):
    AUTH = 'auth', 'Auth'
    PATIENT = 'patient', 'Patient'
    RECORD = 'record', 'Record'
    STAFF = 'staff', 'Staff'
    EMERGENCY = 'emergency', 'Emergency'
    SYSTEM = 'system', 'System'


class AuditLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs',
    )
    patient = models.ForeignKey(
        'patients.Patient', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs',
    )
    action = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.INFO,
    )
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.SYSTEM,
    )
    hospital = models.ForeignKey(
        'hospitals.Hospital', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs',
    )

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        actor = self.user.email if self.user else 'anonymous'
        return f"{actor} – {self.action} at {self.timestamp}"
