from rest_framework import generics, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User, Role
from .serializers import (
    RegisterSerializer, UserSerializer, RoleUpdateSerializer,
    ChangePasswordSerializer, StaffUpdateSerializer, SystemAdminRegisterSerializer,
)
from .permissions import IsAdmin, IsSystemAdmin, IsHospitalAdmin
from apps.audit.utils import log_action
from apps.hospitals.models import Hospital


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAdmin]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if request.user.role == Role.HOSPITAL_ADMIN:
            data['hospital'] = str(request.user.hospital_id)
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_action(
            request.user, None,
            f"created user account: {user.email} (role={user.role})",
            category='staff', severity='info', request=request,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.HOSPITAL_ADMIN:
            return User.objects.filter(hospital=user.hospital).order_by('full_name')
        return User.objects.all().order_by('full_name')


class UserRoleUpdateView(generics.UpdateAPIView):
    serializer_class = RoleUpdateSerializer
    permission_classes = [IsAdmin]
    lookup_field = 'pk'
    http_method_names = ['patch']

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.HOSPITAL_ADMIN:
            return User.objects.filter(hospital=user.hospital)
        return User.objects.all()


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password changed successfully.'})


class StaffViewSet(viewsets.ModelViewSet):
    """
    Full staff CRUD.
    - System admin: sees/manages all users.
    - Hospital admin: sees/manages only their hospital's users (no system_admin creation).
    """
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return StaffUpdateSerializer
        if self.action == 'create':
            return RegisterSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.select_related('hospital').order_by('full_name')
        if user.role == Role.HOSPITAL_ADMIN:
            qs = qs.filter(hospital=user.hospital)
        # filter params
        hospital_id = self.request.query_params.get('hospital')
        role_filter = self.request.query_params.get('role')
        search = self.request.query_params.get('search', '').strip()
        if hospital_id:
            qs = qs.filter(hospital_id=hospital_id)
        if role_filter:
            qs = qs.filter(role=role_filter)
        if search:
            qs = qs.filter(full_name__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if request.user.role == Role.HOSPITAL_ADMIN:
            # Hospital admins can only create doctors/nurses for their hospital
            if data.get('role') in (Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN):
                return Response(
                    {'detail': 'Hospital admins cannot create admin accounts.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            data['hospital'] = str(request.user.hospital_id)
        serializer = RegisterSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_action(
            request.user, None,
            f"created staff account: {user.email} (role={user.role})",
            category='staff', severity='warning', request=request,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        if request.user.role == Role.HOSPITAL_ADMIN:
            if request.data.get('role') in (Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN):
                return Response(
                    {'detail': 'Hospital admins cannot assign admin roles.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        serializer = StaffUpdateSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_action(
            request.user, None,
            f"updated staff account: {user.email}",
            category='staff', severity='warning', request=request,
        )
        return Response(UserSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response(
                {'detail': 'You cannot deactivate your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        log_action(
            request.user, None,
            f"deactivated staff account: {instance.email}",
            category='staff', severity='warning', request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='discharge')
    def discharge(self, request, pk=None):
        """Remove a staff member from their facility without deleting their account."""
        instance = self.get_object()
        reason = request.data.get('reason', '').strip()

        if not reason:
            return Response(
                {'detail': 'A reason is required to remove a staff member from a facility.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.pk == request.user.pk:
            return Response(
                {'detail': 'You cannot remove yourself from a facility.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not instance.hospital:
            return Response(
                {'detail': 'This user is not attached to any facility.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.user.role == Role.HOSPITAL_ADMIN and instance.role in (
            Role.SYSTEM_ADMIN, Role.HOSPITAL_ADMIN
        ):
            return Response(
                {'detail': 'Hospital admins cannot remove admin-level users.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        old_hospital = instance.hospital
        instance.hospital = None
        instance.save(update_fields=['hospital'])

        log_action(
            request.user, None,
            f"removed {instance.email} from {old_hospital.name} — reason: {reason}",
            category='staff', severity='warning', request=request,
        )
        return Response(UserSerializer(instance).data)

    @action(detail=True, methods=['post'], url_path='transfer',
            permission_classes=[IsSystemAdmin])
    def transfer(self, request, pk=None):
        instance = self.get_object()
        hospital_id = request.data.get('hospital_id')
        if not hospital_id:
            return Response({'detail': 'hospital_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            hospital = Hospital.objects.get(pk=hospital_id)
        except Hospital.DoesNotExist:
            return Response({'detail': 'Hospital not found.'}, status=status.HTTP_404_NOT_FOUND)
        old_hospital = instance.hospital
        instance.hospital = hospital
        instance.save(update_fields=['hospital'])
        log_action(
            request.user, None,
            f"transferred {instance.email} from {old_hospital} to {hospital}",
            category='staff', severity='warning', request=request,
        )
        return Response(UserSerializer(instance).data)


class CreateSystemAdminView(generics.CreateAPIView):
    """System admins only — create another system admin account."""
    serializer_class = SystemAdminRegisterSerializer
    permission_classes = [IsSystemAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_action(
            request.user, None,
            f"created system admin account: {user.email}",
            category='staff', severity='warning', request=request,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
