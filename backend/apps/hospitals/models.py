import uuid
from django.db import models


class Hospital(models.Model):
    FACILITY_TYPES = [
        ('hospital', 'Hospital'),
        ('clinic', 'Clinic'),
        ('health_center', 'Health Center'),
        ('pharmacy', 'Pharmacy'),
        ('laboratory', 'Laboratory'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    facility_type = models.CharField(max_length=50, choices=FACILITY_TYPES, default='hospital')
    facility_type_other = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
