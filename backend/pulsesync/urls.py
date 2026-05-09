from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/hospitals/', include('apps.hospitals.urls')),
    path('api/patients/', include('apps.patients.urls')),
    path('api/audit-logs/', include('apps.audit.urls')),
    path('api/emergency/', include('apps.emergency.urls')),
]
