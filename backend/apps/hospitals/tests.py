"""
Tests for the hospitals app.

Covers: hospital CRUD operations restricted to system administrators,
and read access for all authenticated users.
"""
from rest_framework.test import APITestCase
from rest_framework import status
from apps.hospitals.models import Hospital
from apps.accounts.models import User, Role


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_hospital(name='Test Hospital'):
    return Hospital.objects.create(
        name=name,
        facility_type='hospital',
        location='Harare',
        phone='+263771234567',
    )


def make_user(email, role, hospital=None, password='testpass123'):
    return User.objects.create_user(
        email=email, password=password,
        full_name='Test User', role=role, hospital=hospital,
    )


# ---------------------------------------------------------------------------
# Hospital CRUD tests
# ---------------------------------------------------------------------------

class HospitalManagementTest(APITestCase):
    """
    Verifies that hospital management is restricted to system administrators.
    All authenticated users can list hospitals (needed for dropdowns in
    staff-registration forms).
    """

    def setUp(self):
        self.hospital = make_hospital('Parirenyatwa Hospital')
        self.system_admin = make_user('sysadmin@example.com', Role.SYSTEM_ADMIN)
        self.hospital_admin = make_user(
            'hadmin@example.com', Role.HOSPITAL_ADMIN, self.hospital,
        )
        self.nurse = make_user('nurse@example.com', Role.NURSE, self.hospital)

    # -- Create --

    def test_system_admin_can_create_hospital(self):
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.post('/api/hospitals/', {
            'name': 'Harare Central Hospital',
            'facility_type': 'hospital',
            'location': 'Harare CBD',
            'phone': '+263712345678',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Hospital.objects.filter(name='Harare Central Hospital').exists())

    def test_hospital_admin_cannot_create_hospital(self):
        self.client.force_authenticate(user=self.hospital_admin)
        response = self.client.post('/api/hospitals/', {
            'name': 'New Clinic',
            'facility_type': 'clinic',
            'location': 'Bulawayo',
            'phone': '+263772000001',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_nurse_cannot_create_hospital(self):
        self.client.force_authenticate(user=self.nurse)
        response = self.client.post('/api/hospitals/', {
            'name': 'Another Clinic',
            'facility_type': 'clinic',
            'location': 'Mutare',
            'phone': '+263772000002',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_request_cannot_create_hospital(self):
        response = self.client.post('/api/hospitals/', {
            'name': 'Ghost Hospital',
            'facility_type': 'hospital',
            'location': 'Nowhere',
            'phone': '+263000000000',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # -- Read --

    def test_system_admin_can_list_hospitals(self):
        # The hospital ViewSet uses IsSystemAdmin for all actions including list.
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.get('/api/hospitals/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_system_admin_cannot_list_hospitals(self):
        for user in (self.hospital_admin, self.nurse):
            self.client.force_authenticate(user=user)
            response = self.client.get('/api/hospitals/')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN,
                             msg=f'{user.role} should not be able to list hospitals')

    def test_unauthenticated_user_cannot_list_hospitals(self):
        response = self.client.get('/api/hospitals/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_hospital_list_contains_created_hospitals(self):
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.get('/api/hospitals/')
        names = [h['name'] for h in list(response.data)]
        self.assertIn('Parirenyatwa Hospital', names)

    # -- Update --

    def test_system_admin_can_update_hospital(self):
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.patch(
            f'/api/hospitals/{self.hospital.id}/',
            {'phone': '+263771999000'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.hospital.refresh_from_db()
        self.assertEqual(self.hospital.phone, '+263771999000')

    def test_hospital_admin_cannot_update_hospital(self):
        self.client.force_authenticate(user=self.hospital_admin)
        response = self.client.patch(
            f'/api/hospitals/{self.hospital.id}/',
            {'phone': '+263000000000'},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -- Delete --

    def test_system_admin_can_delete_hospital(self):
        hospital_to_delete = make_hospital('Temporary Clinic')
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.delete(f'/api/hospitals/{hospital_to_delete.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Hospital.objects.filter(id=hospital_to_delete.id).exists())

    def test_non_admin_cannot_delete_hospital(self):
        self.client.force_authenticate(user=self.nurse)
        response = self.client.delete(f'/api/hospitals/{self.hospital.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -- Facility type --

    def test_hospital_can_have_facility_type_other_than_hospital(self):
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.post('/api/hospitals/', {
            'name': 'City Pharmacy',
            'facility_type': 'pharmacy',
            'location': 'Harare',
            'phone': '+263712000001',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Hospital.objects.get(name='City Pharmacy').facility_type,
            'pharmacy',
        )
