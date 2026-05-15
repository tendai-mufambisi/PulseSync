"""
Tests for the accounts app.

Covers: user model integrity, authentication endpoints, staff management,
and role-based permission enforcement.
"""
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from apps.hospitals.models import Hospital
from apps.accounts.models import User, Role


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_hospital(name='Test General Hospital'):
    return Hospital.objects.create(
        name=name,
        facility_type='hospital',
        location='Harare',
        phone='+263771234567',
    )


def make_user(email, role, hospital=None, password='testpass123', **kwargs):
    return User.objects.create_user(
        email=email,
        password=password,
        full_name=kwargs.pop('full_name', 'Test User'),
        role=role,
        hospital=hospital,
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

class UserModelTest(TestCase):
    """Unit tests for the User model — no HTTP involved."""

    def setUp(self):
        self.hospital = make_hospital()

    def test_create_user_normalises_email_domain_to_lowercase(self):
        # Django normalise_email only lowercases the domain, not the local part.
        user = make_user('Doctor@EXAMPLE.COM', Role.DOCTOR, self.hospital)
        self.assertEqual(user.email, 'Doctor@example.com')

    def test_user_str_representation(self):
        user = make_user('nurse@example.com', Role.NURSE, self.hospital,
                         full_name='Grace Moyo')
        self.assertIn('Grace Moyo', str(user))
        self.assertIn('nurse', str(user))

    def test_default_role_is_nurse(self):
        user = User.objects.create_user(
            email='default@example.com',
            password='pass',
            full_name='Default User',
        )
        self.assertEqual(user.role, Role.NURSE)

    def test_system_admin_has_no_hospital_by_default(self):
        admin = make_user('sysadmin@example.com', Role.SYSTEM_ADMIN)
        self.assertIsNone(admin.hospital)

    def test_create_superuser_sets_system_admin_role(self):
        superuser = User.objects.create_superuser(
            email='super@example.com',
            password='superpass',
            full_name='Super User',
        )
        self.assertEqual(superuser.role, Role.SYSTEM_ADMIN)
        self.assertTrue(superuser.is_staff)
        self.assertTrue(superuser.is_superuser)

    def test_password_is_hashed_not_stored_in_plain_text(self):
        user = make_user('hash@example.com', Role.DOCTOR, self.hospital,
                         password='supersecret')
        self.assertNotEqual(user.password, 'supersecret')
        self.assertTrue(user.check_password('supersecret'))

    def test_must_change_password_defaults_false(self):
        user = make_user('fresh@example.com', Role.NURSE, self.hospital)
        self.assertFalse(user.must_change_password)


# ---------------------------------------------------------------------------
# Authentication API tests
# ---------------------------------------------------------------------------

class AuthenticationTest(APITestCase):
    """Tests for login, /me/, and change-password endpoints."""

    def setUp(self):
        self.hospital = make_hospital()
        self.user = make_user(
            'doctor@example.com', Role.DOCTOR, self.hospital,
            password='correct-password', full_name='Dr. Adams',
        )

    def test_login_with_valid_credentials_returns_tokens(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'doctor@example.com',
            'password': 'correct-password',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_with_wrong_password_returns_401(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'doctor@example.com',
            'password': 'wrong-password',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_with_unknown_email_returns_401(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'nobody@example.com',
            'password': 'anything',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user_profile(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'doctor@example.com')
        self.assertEqual(response.data['role'], Role.DOCTOR)
        self.assertEqual(response.data['hospital_name'], self.hospital.name)

    def test_me_requires_authentication(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_with_correct_old_password_succeeds(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/change-password/', {
            'old_password': 'correct-password',
            'new_password': 'newSecurePass99!',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newSecurePass99!'))

    def test_change_password_with_wrong_old_password_fails(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/change-password/', {
            'old_password': 'wrong-old-password',
            'new_password': 'newSecurePass99!',
        })
        self.assertIn(response.status_code, [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
        ])


# ---------------------------------------------------------------------------
# Staff management tests
# ---------------------------------------------------------------------------

class StaffManagementTest(APITestCase):
    """Tests for the /api/auth/staff/ endpoints."""

    def setUp(self):
        self.hospital_a = make_hospital('Hospital A')
        self.hospital_b = make_hospital('Hospital B')

        self.system_admin = make_user('sysadmin@example.com', Role.SYSTEM_ADMIN)
        self.hospital_admin = make_user(
            'hadmin@example.com', Role.HOSPITAL_ADMIN, self.hospital_a,
        )
        self.nurse = make_user('nurse@example.com', Role.NURSE, self.hospital_a)

    def test_hospital_admin_can_create_staff_in_own_facility(self):
        self.client.force_authenticate(user=self.hospital_admin)
        response = self.client.post('/api/auth/staff/', {
            'email': 'newdoctor@example.com',
            'full_name': 'Dr. New',
            'role': Role.DOCTOR,
            'password': 'temppass123',
            'hospital': str(self.hospital_a.id),
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='newdoctor@example.com').exists())

    def test_nurse_cannot_create_staff(self):
        self.client.force_authenticate(user=self.nurse)
        response = self.client.post('/api/auth/staff/', {
            'email': 'another@example.com',
            'full_name': 'Someone',
            'role': Role.NURSE,
            'password': 'temppass123',
            'hospital': str(self.hospital_a.id),
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_admin_can_list_all_staff(self):
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.get('/api/auth/staff/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_hospital_admin_staff_list_scoped_to_own_hospital(self):
        make_user('other_hospital_nurse@example.com', Role.NURSE, self.hospital_b)
        self.client.force_authenticate(user=self.hospital_admin)
        response = self.client.get('/api/auth/staff/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emails = [u['email'] for u in list(response.data)]
        self.assertNotIn('other_hospital_nurse@example.com', emails)

    def test_unauthenticated_user_cannot_access_staff_list(self):
        response = self.client.get('/api/auth/staff/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# Permission enforcement tests
# ---------------------------------------------------------------------------

class PermissionEnforcementTest(APITestCase):
    """Verifies that role-based access restrictions are applied correctly."""

    def setUp(self):
        self.hospital = make_hospital()
        self.system_admin = make_user('sysadmin@example.com', Role.SYSTEM_ADMIN)
        self.hospital_admin = make_user(
            'hadmin@example.com', Role.HOSPITAL_ADMIN, self.hospital,
        )
        self.doctor = make_user('doctor@example.com', Role.DOCTOR, self.hospital)
        self.nurse = make_user('nurse@example.com', Role.NURSE, self.hospital)

    def test_only_system_admin_can_create_another_system_admin(self):
        self.client.force_authenticate(user=self.system_admin)
        response = self.client.post('/api/auth/admins/', {
            'email': 'newsysadmin@example.com',
            'full_name': 'New SysAdmin',
            'password': 'securePass123!',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_hospital_admin_cannot_create_system_admin(self):
        self.client.force_authenticate(user=self.hospital_admin)
        response = self.client.post('/api/auth/admins/', {
            'email': 'wannabesys@example.com',
            'full_name': 'Wannabe',
            'password': 'securePass123!',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_nurse_cannot_create_system_admin(self):
        self.client.force_authenticate(user=self.nurse)
        response = self.client.post('/api/auth/admins/', {
            'email': 'wannabe2@example.com',
            'full_name': 'Wannabe2',
            'password': 'securePass123!',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_list_accessible_to_admins(self):
        for admin in (self.system_admin, self.hospital_admin):
            self.client.force_authenticate(user=admin)
            response = self.client.get('/api/auth/users/')
            self.assertEqual(response.status_code, status.HTTP_200_OK,
                             msg=f'{admin.role} should be able to list users')

    def test_user_list_forbidden_for_non_admins(self):
        for non_admin in (self.doctor, self.nurse):
            self.client.force_authenticate(user=non_admin)
            response = self.client.get('/api/auth/users/')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN,
                             msg=f'{non_admin.role} should not be able to list users')
