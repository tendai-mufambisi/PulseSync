from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Patient, ClinicalRecord
from .serializers import PatientSerializer, PatientListSerializer, ClinicalRecordSerializer
from apps.accounts.permissions import HasAnyRole, IsSystemAdmin
from apps.accounts.models import Role
from apps.audit.utils import log_action


class PatientViewSet(viewsets.ModelViewSet):
    permission_classes = [HasAnyRole]

    def get_serializer_class(self):
        if self.action == 'list':
            return PatientListSerializer
        return PatientSerializer

    def get_queryset(self):
        qs = Patient.objects.all()
        national_id = self.request.query_params.get('national_id', '').strip()
        search = self.request.query_params.get('search', '').strip()
        if national_id:
            qs = qs.filter(national_id__icontains=national_id)
        if search:
            qs = qs.filter(full_name__icontains=search)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            hospital=self.request.user.hospital,
        )

    def destroy(self, request, *args, **kwargs):
        if not (request.user.role == Role.SYSTEM_ADMIN):
            return Response(
                {'detail': 'Only system administrators can delete patients.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        patient = self.get_object()
        log_action(
            request.user, patient,
            f"viewed patient profile: {patient.full_name}",
            category='patient', severity='info', request=request,
        )
        return Response(self.get_serializer(patient).data)

    @action(detail=True, methods=['get', 'post'], url_path='records')
    def records(self, request, pk=None):
        patient = self.get_object()
        if request.method == 'GET':
            serializer = ClinicalRecordSerializer(patient.records.all(), many=True)
            return Response(serializer.data)

        if request.user.role not in (Role.DOCTOR, Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN):
            return Response(
                {'detail': 'Only doctors can add clinical records.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ClinicalRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(patient=patient, author=request.user)
        log_action(
            request.user, patient,
            f"added clinical record for {patient.full_name}",
            category='record', severity='info', request=request,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='emergency',
            permission_classes=[permissions.AllowAny])
    def emergency(self, request, pk=None):
        try:
            patient = Patient.objects.get(pk=pk)
        except (Patient.DoesNotExist, ValueError):
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        actor = request.user if (request.user and request.user.is_authenticated) else None
        log_action(
            actor, patient,
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
