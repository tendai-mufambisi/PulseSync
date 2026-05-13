from rest_framework.permissions import BasePermission
from .models import Role


class IsSystemAdmin(BasePermission):
    """Platform-level admin: role=system_admin."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == Role.SYSTEM_ADMIN
        )


class IsHospitalAdmin(BasePermission):
    """Hospital-level admin: role=hospital_admin."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == Role.HOSPITAL_ADMIN
        )


class IsAdmin(BasePermission):
    """Any admin — system admin or hospital admin."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN)
        )


class IsDoctorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR)
        )


class HasAnyRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (
                Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN, Role.DOCTOR, Role.NURSE
            )
        )
