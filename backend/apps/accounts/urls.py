from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView
from .views import RegisterView, MeView, UserListView, UserRoleUpdateView, ChangePasswordView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', TokenObtainPairView.as_view(), name='auth-login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<uuid:pk>/role/', UserRoleUpdateView.as_view(), name='user-role-update'),
]
