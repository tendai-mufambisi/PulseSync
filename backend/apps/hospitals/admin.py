from django import forms
from django.contrib import admin
from apps.accounts.models import User, Role
from .models import Hospital


class HospitalStaffForm(forms.ModelForm):
    password = forms.CharField(
        widget=forms.PasswordInput(render_value=False),
        required=False,
        help_text='Required for new accounts. Leave blank to keep existing password.',
    )

    class Meta:
        model = User
        # 'password' is intentionally excluded so _post_clean() never overwrites
        # instance.password with the raw (or blank) form value — save() handles it manually.
        fields = ('full_name', 'email', 'role', 'is_active')

    def clean(self):
        cleaned = super().clean()
        if not self.instance.pk and not cleaned.get('password'):
            raise forms.ValidationError('Password is required when creating a new staff account.')
        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get('password')
        if password:
            user.set_password(password)
            user.must_change_password = True
        if commit:
            user.save()
        return user


class HospitalStaffInline(admin.StackedInline):
    model = User
    form = HospitalStaffForm
    extra = 0
    fields = ('full_name', 'email', 'role', 'password', 'is_active')
    show_change_link = True
    # 'password' is a form-level field (not in Meta.fields), so it must be listed
    # here explicitly for the inline renderer to include it.
    verbose_name = 'Staff Member'
    verbose_name_plural = 'Staff Members'
    classes = ('collapse',)


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'phone', 'staff_count', 'created_at')
    search_fields = ('name', 'location')
    ordering = ('name',)
    readonly_fields = ('id', 'created_at')
    inlines = [HospitalStaffInline]

    fieldsets = (
        (None, {'fields': ('id', 'name')}),
        ('Contact', {'fields': ('location', 'phone')}),
        ('Meta', {'fields': ('created_at',)}),
    )

    def staff_count(self, obj):
        return obj.staff.count()
    staff_count.short_description = 'Staff'
