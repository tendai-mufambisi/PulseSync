from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Value
from django.db.models.functions import Replace
from .models import Patient, ClinicalRecord, HealthEvent
from .serializers import (
    PatientSerializer, PatientListSerializer, PatientCreateSerializer,
    ClinicalRecordSerializer, ParamedicPatientSerializer,
    HealthEventSerializer,
)
from apps.accounts.permissions import HasAnyRole, IsSystemAdmin
from apps.accounts.models import Role
from apps.audit.utils import log_action


class PatientViewSet(viewsets.ModelViewSet):
    permission_classes = [HasAnyRole]

    def get_serializer_class(self):
        if self.action == 'create':
            return PatientCreateSerializer
        if self.action == 'list':
            return PatientListSerializer
        if getattr(self.request.user, 'role', None) == Role.PARAMEDIC:
            return ParamedicPatientSerializer
        return PatientSerializer

    def get_queryset(self):
        qs = Patient.objects.all()
        national_id = self.request.query_params.get('national_id', '').strip()
        search = self.request.query_params.get('search', '').strip()
        q = self.request.query_params.get('q', '').strip()
        reg_type = self.request.query_params.get('registration_type', '').strip()

        if national_id:
            normalized = national_id.replace('-', '')
            qs = qs.annotate(
                _id_nodash=Replace('national_id', Value('-'), Value(''))
            ).filter(
                Q(national_id__icontains=national_id) |
                Q(_id_nodash__icontains=normalized)
            )

        if search:
            qs = qs.filter(full_name__icontains=search)

        if q:
            q_nodash = q.replace('-', '')
            qs = qs.annotate(
                _id_nodash=Replace('national_id', Value('-'), Value(''))
            ).filter(
                Q(full_name__icontains=q) |
                Q(national_id__icontains=q) |
                Q(_id_nodash__icontains=q_nodash)
            )

        if reg_type in ('newborn', 'existing'):
            qs = qs.filter(registration_type=reg_type)

        return qs

    def _deny_paramedic(self, request):
        if request.user.role == Role.PARAMEDIC:
            return Response(
                {'detail': 'Paramedics have read-only access to emergency patient data.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def create(self, request, *args, **kwargs):
        denial = self._deny_paramedic(request)
        if denial:
            return denial
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denial = self._deny_paramedic(request)
        if denial:
            return denial
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        denial = self._deny_paramedic(request)
        if denial:
            return denial
        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        patient = serializer.save(
            created_by=self.request.user,
            hospital=self.request.user.hospital,
        )
        log_action(
            self.request.user, patient,
            f"registered patient ({patient.registration_type}): {patient.full_name}",
            category='patient', severity='info', request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        if request.user.role != Role.SYSTEM_ADMIN:
            return Response(
                {'detail': 'Only system administrators can delete patients.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        patient = self.get_object()
        if request.user.role == Role.PARAMEDIC:
            log_action(
                request.user, patient,
                f"PARAMEDIC_ACCESS: {patient.full_name} (national_id={patient.national_id})",
                category='emergency', severity='warning', request=request,
            )
        else:
            log_action(
                request.user, patient,
                f"viewed patient profile: {patient.full_name}",
                category='patient', severity='info', request=request,
            )
        return Response(self.get_serializer(patient).data)

    # ------------------------------------------------------------------
    # Health timeline endpoint (new — longitudinal structured records)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get', 'post'], url_path='timeline')
    def timeline(self, request, pk=None):
        if request.user.role == Role.PARAMEDIC:
            return Response(
                {'detail': 'Paramedics do not have access to the health timeline.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        patient = self.get_object()

        if request.method == 'GET':
            events = patient.health_events.all()
            # Nurses cannot view sensitive records
            if request.user.role == Role.NURSE:
                events = events.filter(is_sensitive=False)
            serializer = HealthEventSerializer(events, many=True, context={'request': request})
            return Response(serializer.data)

        # POST — add a new health event
        if request.user.role not in (Role.DOCTOR, Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN):
            return Response(
                {'detail': 'Only doctors and administrators can add health events.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = HealthEventSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        event = serializer.save(
            patient=patient,
            clinician=request.user,
            hospital=request.user.hospital,
            created_by=request.user,
        )
        log_action(
            request.user, patient,
            f"added {event.get_event_type_display()} event for {patient.full_name}",
            category='record', severity='info', request=request,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='timeline/(?P<event_pk>[^/.]+)')
    def timeline_detail(self, request, pk=None, event_pk=None):
        if request.user.role == Role.PARAMEDIC:
            return Response(
                {'detail': 'Paramedics do not have access to the health timeline.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        patient = self.get_object()
        try:
            event = patient.health_events.get(pk=event_pk)
        except HealthEvent.DoesNotExist:
            return Response({'detail': 'Health event not found.'}, status=status.HTTP_404_NOT_FOUND)

        if event.is_sensitive and request.user.role == Role.NURSE:
            return Response(
                {'detail': 'You do not have access to sensitive records.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(HealthEventSerializer(event, context={'request': request}).data)

    # ------------------------------------------------------------------
    # Legacy records endpoint (backward compat — ClinicalRecord)
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get', 'post'], url_path='records')
    def records(self, request, pk=None):
        if request.user.role == Role.PARAMEDIC:
            return Response(
                {'detail': 'Paramedics do not have access to clinical records.'},
                status=status.HTTP_403_FORBIDDEN,
            )
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
