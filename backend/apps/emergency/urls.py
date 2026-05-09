from django.urls import path
from .views import EmergencyView

urlpatterns = [
    path('<uuid:patient_id>/', EmergencyView.as_view(), name='emergency-view'),
]
