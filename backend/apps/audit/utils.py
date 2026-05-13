from .models import AuditLog


def log_action(
    user,
    patient,
    action: str,
    category: str = 'system',
    severity: str = 'info',
    request=None,
) -> None:
    from apps.accounts.models import User
    ip = None
    if request:
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ip = forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')
        ip = ip or None

    hospital = getattr(user, 'hospital', None) if user else None

    AuditLog.objects.create(
        user=user if isinstance(user, User) else None,
        patient=patient,
        action=action,
        category=category,
        severity=severity,
        hospital=hospital,
        ip_address=ip,
    )
