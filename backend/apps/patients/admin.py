from django.contrib import admin
from .models import Patient, ClinicalRecord


class ClinicalRecordInline(admin.TabularInline):
    model = ClinicalRecord
    extra = 0
    readonly_fields = ('id', 'author', 'date', 'created_at')
    fields = ('date', 'author', 'diagnosis', 'medications', 'notes')


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'national_id', 'gender', 'blood_type', 'created_by', 'created_at')
    list_filter = ('gender', 'blood_type')
    search_fields = ('full_name', 'national_id')
    ordering = ('full_name',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [ClinicalRecordInline]

    fieldsets = (
        ('Identity', {'fields': ('id', 'national_id', 'full_name', 'date_of_birth', 'gender')}),
        ('Medical', {'fields': ('blood_type', 'allergies', 'critical_conditions', 'hiv_status', 'notes')}),
        ('Contact', {'fields': ('emergency_contact',)}),
        ('Institution', {'fields': ('hospital',)}),
        ('Meta', {'fields': ('created_by', 'created_at', 'updated_at')}),
    )


@admin.register(ClinicalRecord)
class ClinicalRecordAdmin(admin.ModelAdmin):
    list_display = ('patient', 'diagnosis', 'author', 'date')
    list_filter = ('date',)
    search_fields = ('patient__full_name', 'patient__national_id', 'diagnosis')
    readonly_fields = ('id', 'date', 'created_at')
