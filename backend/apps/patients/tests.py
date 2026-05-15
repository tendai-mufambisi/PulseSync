"""
Tests for the patients app.

Covers: patient registration (existing + newborn), national ID validation,
role-based data access, health timeline, and unauthenticated emergency access.
"""
import datetime
from rest_framework.test import APITestCase
from rest_framework import status
from apps.hospitals.models import Hospital
from apps.accounts.models import User, Role
from apps.patients.models import Patient, HealthEvent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_hospital(name='Central Hospital'):
    return Hospital.objects.create(
        name=name, facility_type='hospital',
        location='Harare', phone='+263771234567',
    )


def make_user(email, role, hospital=None, password='testpass123', full_name='Test User'):
    return User.objects.create_user(
        email=email, password=password, full_name=full_name,
        role=role, hospital=hospital,
    )


EXISTING_PATIENT_PAYLOAD = {
    'registration_type': 'existing',
    'national_id': '63-2400679R42',
    'full_name': 'Tawana Mabaya',
    'date_of_birth': '1990-05-15',
    'gender': 'male',
    'blood_type': 'O+',
}

NEWBORN_PAYLOAD = {
    'registration_type': 'newborn',
    'full_name': 'Baby Moyo',
    'date_of_birth': str(datetime.date.today()),
    'gender': 'female',
    'blood_type': 'unknown',
    'guardian_name': 'Rudo Moyo',
    'guardian_relationship': 'Mother',
}


# ---------------------------------------------------------------------------
# Patient registration
# ---------------------------------------------------------------------------

class PatientRegistrationTest(APITestCase):
    """Tests for POST /api/patients/ — both registration paths."""

    def setUp(self):
        self.hospital = make_hospital()
        self.doctor = make_user(
            'doctor@example.com', Role.DOCTOR, self.hospital,
            full_name='Dr. Chipo Dube',
        )
        self.client.force_authenticate(user=self.doctor)

    def test_register_existing_patient_with_valid_national_id(self):
        response = self.client.post('/api/patients/', EXISTING_PATIENT_PAYLOAD)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Patient.objects.filter(full_name='Tawana Mabaya').exists())

    def test_register_existing_patient_without_national_id_fails(self):
        payload = {**EXISTING_PATIENT_PAYLOAD}
        payload.pop('national_id')
        response = self.client.post('/api/patients/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('national_id', response.data)

    def test_register_newborn_without_national_id_succeeds(self):
        response = self.client.post('/api/patients/', NEWBORN_PAYLOAD)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        patient = Patient.objects.get(full_name='Baby Moyo')
        self.assertEqual(patient.registration_type, 'newborn')
        self.assertIsNone(patient.national_id)

    def test_register_newborn_auto_creates_birth_health_event(self):
        self.client.post('/api/patients/', NEWBORN_PAYLOAD)
        patient = Patient.objects.get(full_name='Baby Moyo')
        birth_events = patient.health_events.filter(
            event_type=HealthEvent.EventType.BIRTH
        )
        self.assertEqual(birth_events.count(), 1)

    def test_register_newborn_without_guardian_name_fails(self):
        payload = {**NEWBORN_PAYLOAD}
        payload.pop('guardian_name')
        response = self.client.post('/api/patients/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('guardian_name', response.data)

    def test_duplicate_national_id_returns_error(self):
        self.client.post('/api/patients/', EXISTING_PATIENT_PAYLOAD)
        response = self.client.post('/api/patients/', {
            **EXISTING_PATIENT_PAYLOAD,
            'full_name': 'Someone Else',
        })
        self.assertIn(response.status_code, [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_409_CONFLICT,
        ])

    def test_patient_list_returns_registered_patients(self):
        self.client.post('/api/patients/', EXISTING_PATIENT_PAYLOAD)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [p['full_name'] for p in list(response.data)]
        self.assertIn('Tawana Mabaya', names)


# ---------------------------------------------------------------------------
# National ID validation
# ---------------------------------------------------------------------------

class NationalIDValidationTest(APITestCase):
    """Ensures the Zimbabwean national ID format is strictly enforced."""

    def setUp(self):
        self.hospital = make_hospital()
        self.doctor = make_user('doctor@example.com', Role.DOCTOR, self.hospital)
        self.client.force_authenticate(user=self.doctor)

    def _post_with_id(self, national_id):
        return self.client.post('/api/patients/', {
            **EXISTING_PATIENT_PAYLOAD,
            'national_id': national_id,
        })

    def test_valid_national_id_accepted(self):
        response = self._post_with_id('63-2400679R42')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_id_without_letter_rejected(self):
        response = self._post_with_id('63-240067942')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_id_wrong_separator_rejected(self):
        # Uses slash instead of hyphen
        response = self._post_with_id('63/2400679R42')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_id_too_short_rejected(self):
        response = self._post_with_id('6-2400679R42')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_id_with_spaces_rejected(self):
        response = self._post_with_id('63 2400679R42')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_letter_in_id_normalised_to_uppercase(self):
        # Lowercase letter in national ID should be normalised to uppercase
        response = self._post_with_id('63-2400679r42')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        patient = Patient.objects.get(full_name='Tawana Mabaya')
        self.assertEqual(patient.national_id[-3], patient.national_id[-3].upper())


# ---------------------------------------------------------------------------
# Role-based patient data access
# ---------------------------------------------------------------------------

class RoleBasedPatientAccessTest(APITestCase):
    """Verifies that different roles see the correct level of patient detail."""

    def setUp(self):
        self.hospital = make_hospital()
        self.doctor = make_user('doctor@example.com', Role.DOCTOR, self.hospital)
        self.nurse = make_user('nurse@example.com', Role.NURSE, self.hospital)
        self.paramedic = make_user('paramedic@example.com', Role.PARAMEDIC, self.hospital)

        # Create a patient with sensitive HIV data
        self.client.force_authenticate(user=self.doctor)
        self.client.post('/api/patients/', {
            **EXISTING_PATIENT_PAYLOAD,
            'hiv_status': 'positive',
        })
        self.patient = Patient.objects.get(full_name='Tawana Mabaya')

        # Add a sensitive health event to the timeline
        HealthEvent.objects.create(
            patient=self.patient,
            event_type=HealthEvent.EventType.SENSITIVE,
            event_date=datetime.date.today(),
            is_sensitive=True,
            sensitive_category='hiv',
            summary='Sensitive clinical note',
            created_by=self.doctor,
        )

    def test_doctor_can_see_hiv_status(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get(f'/api/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['hiv_status'], 'positive')

    def test_nurse_sees_hiv_status_redacted(self):
        self.client.force_authenticate(user=self.nurse)
        response = self.client.get(f'/api/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['hiv_status'], '[REDACTED]')

    def test_nurse_cannot_see_sensitive_health_events(self):
        self.client.force_authenticate(user=self.nurse)
        response = self.client.get(f'/api/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sensitive = [
            e for e in response.data.get('health_events', [])
            if e.get('is_sensitive')
        ]
        self.assertEqual(len(sensitive), 0)

    def test_doctor_can_see_sensitive_health_events(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get(f'/api/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sensitive = [
            e for e in response.data.get('health_events', [])
            if e.get('is_sensitive')
        ]
        self.assertEqual(len(sensitive), 1)

    def test_paramedic_gets_limited_emergency_fields_only(self):
        self.client.force_authenticate(user=self.paramedic)
        response = self.client.get(f'/api/patients/{self.patient.id}/emergency/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should NOT include clinical or sensitive fields
        self.assertNotIn('hiv_status', response.data)
        self.assertNotIn('national_id', response.data)
        self.assertNotIn('health_events', response.data)
        # Should include emergency-relevant fields
        self.assertIn('full_name', response.data)
        self.assertIn('blood_type', response.data)
        self.assertIn('allergies', response.data)

    def test_paramedic_cannot_register_new_patient(self):
        # Paramedics have emergency read-only access — they cannot register patients.
        self.client.force_authenticate(user=self.paramedic)
        payload = {**EXISTING_PATIENT_PAYLOAD, 'national_id': '10-1234567B12'}
        response = self.client.post('/api/patients/', payload)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# Health timeline tests
# ---------------------------------------------------------------------------

class HealthTimelineTest(APITestCase):
    """Tests for GET/POST /api/patients/<id>/timeline/."""

    def setUp(self):
        self.hospital = make_hospital()
        self.doctor = make_user('doctor@example.com', Role.DOCTOR, self.hospital)
        self.nurse = make_user('nurse@example.com', Role.NURSE, self.hospital)

        # Create a patient to work with
        self.client.force_authenticate(user=self.doctor)
        self.client.post('/api/patients/', EXISTING_PATIENT_PAYLOAD)
        self.patient = Patient.objects.get(full_name='Tawana Mabaya')

    def test_doctor_can_add_consultation_event(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post(
            f'/api/patients/{self.patient.id}/timeline/',
            {
                'event_type': 'consultation',
                'event_date': str(datetime.date.today()),
                'summary': 'Routine check-up. Patient in good health.',
                'diagnosis': 'No acute conditions found.',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.patient.health_events.count(), 1)

    def test_nurse_cannot_add_health_event(self):
        self.client.force_authenticate(user=self.nurse)
        response = self.client.post(
            f'/api/patients/{self.patient.id}/timeline/',
            {
                'event_type': 'consultation',
                'event_date': str(datetime.date.today()),
                'summary': 'Nurse note',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sensitive_event_type_automatically_sets_is_sensitive_flag(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post(
            f'/api/patients/{self.patient.id}/timeline/',
            {
                'event_type': 'sensitive',
                'event_date': str(datetime.date.today()),
                'sensitive_category': 'mental_health',
                'summary': 'Patient disclosed history of depression.',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        event = self.patient.health_events.get(event_type='sensitive')
        self.assertTrue(event.is_sensitive)

    def test_sensitive_category_on_non_sensitive_event_is_rejected(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post(
            f'/api/patients/{self.patient.id}/timeline/',
            {
                'event_type': 'consultation',
                'event_date': str(datetime.date.today()),
                'sensitive_category': 'hiv',
                'summary': 'This should fail.',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sensitive_category', response.data)

    def test_timeline_is_returned_in_chronological_order(self):
        self.client.force_authenticate(user=self.doctor)
        dates = ['2024-01-15', '2024-03-20', '2024-02-10']
        for d in dates:
            self.client.post(f'/api/patients/{self.patient.id}/timeline/', {
                'event_type': 'consultation',
                'event_date': d,
                'summary': f'Visit on {d}',
            })
        response = self.client.get(f'/api/patients/{self.patient.id}/timeline/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        events = list(response.data)
        event_dates = [e['event_date'] for e in events]
        self.assertEqual(event_dates, sorted(event_dates, reverse=True))


# ---------------------------------------------------------------------------
# Emergency access tests
# ---------------------------------------------------------------------------

class EmergencyAccessTest(APITestCase):
    """
    The emergency endpoint is AllowAny — accessible without authentication
    so paramedics in the field can look up critical patient info.
    """

    def setUp(self):
        self.hospital = make_hospital()
        self.doctor = make_user('doctor@example.com', Role.DOCTOR, self.hospital)
        self.client.force_authenticate(user=self.doctor)
        self.client.post('/api/patients/', {
            **EXISTING_PATIENT_PAYLOAD,
            'allergies': 'Penicillin',
            'blood_type': 'AB+',
            'next_of_kin_name': 'Sisi Mabaya',
            'next_of_kin_phone': '+263771999888',
        })
        self.patient = Patient.objects.get(full_name='Tawana Mabaya')
        self.client.logout()
        self.client.force_authenticate(user=None)

    def test_emergency_endpoint_accessible_without_authentication(self):
        response = self.client.get(f'/api/patients/{self.patient.id}/emergency/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_emergency_response_includes_critical_clinical_fields(self):
        response = self.client.get(f'/api/patients/{self.patient.id}/emergency/')
        self.assertEqual(response.data['blood_type'], 'AB+')
        self.assertEqual(response.data['allergies'], 'Penicillin')

    def test_emergency_response_includes_next_of_kin(self):
        response = self.client.get(f'/api/patients/{self.patient.id}/emergency/')
        self.assertEqual(response.data['next_of_kin_name'], 'Sisi Mabaya')
        self.assertEqual(response.data['next_of_kin_phone'], '+263771999888')

    def test_emergency_response_excludes_sensitive_fields(self):
        response = self.client.get(f'/api/patients/{self.patient.id}/emergency/')
        self.assertNotIn('hiv_status', response.data)
        self.assertNotIn('national_id', response.data)
        self.assertNotIn('health_events', response.data)

    def test_emergency_endpoint_for_nonexistent_patient_returns_404(self):
        import uuid
        response = self.client.get(f'/api/patients/{uuid.uuid4()}/emergency/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
