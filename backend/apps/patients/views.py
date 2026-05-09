from rest_framework import viewsets, status
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
        user = self.request.user
        qs = Patient.objects.all()

        # Scope to hospital for all non-system-admin users
        if user.hospital is not None:
            qs = qs.filter(hospital=user.hospital)

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

    def create(self, request, *args, **kwargs):
        if request.user.role == Role.DOCTOR:
            return Response(
                {'detail': 'Doctors cannot register patients.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.role == Role.ADMIN and request.user.hospital is None):
            return Response(
                {'detail': 'Only system administrators can delete patients.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        patient = self.get_object()
        log_action(request.user, patient, f"viewed patient profile: {patient.full_name}")
        return Response(self.get_serializer(patient).data)

    @action(detail=True, methods=['get', 'post'], url_path='records')
    def records(self, request, pk=None):
        patient = self.get_object()
        if request.method == 'GET':
            serializer = ClinicalRecordSerializer(patient.records.all(), many=True)
            return Response(serializer.data)

        # Only doctors can create clinical records
        if request.user.role != Role.DOCTOR:
            return Response(
                {'detail': 'Only doctors can add clinical records.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ClinicalRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(patient=patient, author=request.user)
        log_action(request.user, patient, f"added clinical record for {patient.full_name}")
        return Response(serializer.data, status=status.HTTP_201_CREATED)
