from rest_framework import generics
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.accounts.permissions import IsAdmin


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user', 'patient').all()
        user = self.request.user
        if user.hospital is not None:
            # Hospital admin: only see events from their own staff
            qs = qs.filter(user__hospital=user.hospital)
        return qs
