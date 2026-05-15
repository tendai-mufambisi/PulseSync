from django.urls import path
from .views import AuditLogListView, LogUnauthorizedAccessView

urlpatterns = [
    path('', AuditLogListView.as_view(), name='audit-log-list'),
    path('unauthorized/', LogUnauthorizedAccessView.as_view(), name='audit-log-unauthorized'),
]
