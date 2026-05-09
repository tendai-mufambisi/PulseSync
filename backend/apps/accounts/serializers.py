from rest_framework import serializers
from .models import User, Role
from apps.hospitals.models import Hospital


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    hospital = serializers.PrimaryKeyRelatedField(
        queryset=Hospital.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = ('email', 'password', 'full_name', 'role', 'hospital')

    def validate(self, attrs):
        role = attrs.get('role', Role.NURSE)
        hospital = attrs.get('hospital')
        if role != Role.ADMIN and not hospital:
            raise serializers.ValidationError(
                {'hospital': 'A hospital must be assigned for doctors and nurses.'}
            )
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(must_change_password=True, **validated_data)


class UserSerializer(serializers.ModelSerializer):
    hospital_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'full_name', 'role', 'hospital', 'hospital_name',
                  'must_change_password', 'created_at')
        read_only_fields = ('id', 'hospital_name', 'must_change_password', 'created_at')

    def get_hospital_name(self, obj):
        return obj.hospital.name if obj.hospital else None


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password'])


class RoleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('role',)

    def validate_role(self, value):
        if value not in (Role.ADMIN, Role.DOCTOR, Role.NURSE):
            raise serializers.ValidationError('Invalid role.')
        return value

    def update(self, instance, validated_data):
        instance.role = validated_data['role']
        instance.is_staff = instance.role == Role.ADMIN
        instance.save()
        return instance
