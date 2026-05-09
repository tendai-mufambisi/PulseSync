from .models import AuditLog


def log_action(user, patient, action: str) -> None:
    from apps.accounts.models import User
    AuditLog.objects.create(
        user=user if isinstance(user, User) else None,
        patient=patient,
        action=action,
    )
