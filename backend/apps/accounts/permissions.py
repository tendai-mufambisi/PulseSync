from rest_framework.permissions import BasePermission
from .models import Role


class IsSystemAdmin(BasePermission):
    """Platform-level admin: role=admin with no hospital assigned."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == Role.ADMIN
            and request.user.hospital is None
        )


class IsAdmin(BasePermission):
    """Any admin — system admin or hospital admin."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == Role.ADMIN
        )


class IsDoctorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.DOCTOR)
        )


class HasAnyRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (Role.ADMIN, Role.DOCTOR, Role.NURSE)
        )
