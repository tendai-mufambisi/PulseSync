from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User
from .serializers import RegisterSerializer, UserSerializer, RoleUpdateSerializer, ChangePasswordSerializer
from .permissions import IsAdmin


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAdmin]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        # Hospital admin: force their own hospital, no choice
        if request.user.hospital is not None:
            data['hospital'] = str(request.user.hospital_id)
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.hospital is not None:
            return User.objects.filter(hospital=user.hospital).order_by('full_name')
        return User.objects.all().order_by('full_name')


class UserRoleUpdateView(generics.UpdateAPIView):
    serializer_class = RoleUpdateSerializer
    permission_classes = [IsAdmin]
    lookup_field = 'pk'
    http_method_names = ['patch']

    def get_queryset(self):
        user = self.request.user
        if user.hospital is not None:
            return User.objects.filter(hospital=user.hospital)
        return User.objects.all()


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password changed successfully.'})
