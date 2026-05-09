from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'full_name', 'role', 'hospital', 'is_active', 'created_at')
    list_filter = ('role', 'hospital', 'is_active')
    search_fields = ('email', 'full_name')
    ordering = ('full_name',)
    readonly_fields = ('id', 'created_at', 'last_login')

    fieldsets = (
        ('Account', {'fields': ('id', 'email', 'password')}),
        ('Personal', {'fields': ('full_name',)}),
        ('Role & Institution', {'fields': ('role', 'hospital')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Timestamps', {'fields': ('last_login', 'created_at')}),
    )

    add_fieldsets = (
        ('Account', {'fields': ('email', 'password1', 'password2')}),
        ('Personal', {'fields': ('full_name',)}),
        ('Role & Institution', {'fields': ('role', 'hospital')}),
    )

    filter_horizontal = ('groups', 'user_permissions')
