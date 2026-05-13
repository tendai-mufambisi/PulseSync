from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.accounts.permissions import IsAdmin
from apps.accounts.models import Role


class AuditLogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]
    pagination_class = AuditLogPagination

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user', 'patient', 'hospital').all()
        user = self.request.user

        if user.role == Role.HOSPITAL_ADMIN:
            qs = qs.filter(hospital=user.hospital)

        params = self.request.query_params
        if severity := params.get('severity'):
            qs = qs.filter(severity=severity)
        if category := params.get('category'):
            qs = qs.filter(category=category)
        if hospital_id := params.get('hospital'):
            if user.role == Role.SYSTEM_ADMIN:
                qs = qs.filter(hospital_id=hospital_id)
        if user_id := params.get('user'):
            qs = qs.filter(user_id=user_id)
        if date_from := params.get('date_from'):
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to := params.get('date_to'):
            qs = qs.filter(timestamp__date__lte=date_to)

        return qs
