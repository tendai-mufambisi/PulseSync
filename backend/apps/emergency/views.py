from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.patients.models import Patient
from apps.audit.utils import log_action


class EmergencyView(APIView):
    """Legacy endpoint kept for backward compatibility."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, patient_id):
        try:
            patient = Patient.objects.get(id=patient_id)
        except (Patient.DoesNotExist, ValueError):
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        log_action(
            None,
            patient,
            f"EMERGENCY_ACCESS: {patient.full_name} (national_id={patient.national_id})",
            category='emergency', severity='warning', request=request,
        )

        return Response({
            'id': str(patient.id),
            'full_name': patient.full_name,
            'date_of_birth': str(patient.date_of_birth),
            'blood_type': patient.blood_type,
            'allergies': patient.allergies,
            'critical_conditions': patient.critical_conditions,
            'chronic_conditions': patient.chronic_conditions,
            'next_of_kin_name': patient.next_of_kin_name,
            'next_of_kin_relationship': patient.next_of_kin_relationship,
            'next_of_kin_phone': patient.next_of_kin_phone,
            'next_of_kin_alt_phone': patient.next_of_kin_alt_phone,
            'emergency_contact': patient.emergency_contact,
            'emergency_contact_2_name': patient.emergency_contact_2_name,
            'emergency_contact_2_phone': patient.emergency_contact_2_phone,
            'emergency_contact_3_name': patient.emergency_contact_3_name,
            'emergency_contact_3_phone': patient.emergency_contact_3_phone,
        })
