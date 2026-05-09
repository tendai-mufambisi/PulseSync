from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.patients.models import Patient
from apps.audit.utils import log_action


class EmergencyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, patient_id):
        try:
            patient = Patient.objects.get(id=patient_id)
        except (Patient.DoesNotExist, ValueError):
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        log_action(
            None,
            patient,
            f"emergency access: {patient.full_name} (national_id={patient.national_id})",
        )

        return Response({
            'id': str(patient.id),
            'full_name': patient.full_name,
            'blood_type': patient.blood_type,
            'allergies': patient.allergies,
            'critical_conditions': patient.critical_conditions,
            'emergency_contact': patient.emergency_contact,
        })
