from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'patient', 'action', 'ip_address')
    list_filter = ('timestamp',)
    search_fields = ('user__email', 'patient__full_name', 'action')
    readonly_fields = ('id', 'user', 'patient', 'action', 'timestamp', 'ip_address')
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
