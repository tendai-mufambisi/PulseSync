from rest_framework import viewsets
from .models import Hospital
from .serializers import HospitalSerializer
from apps.accounts.permissions import IsSystemAdmin


class HospitalViewSet(viewsets.ModelViewSet):
    queryset = Hospital.objects.all()
    serializer_class = HospitalSerializer
    permission_classes = [IsSystemAdmin]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
