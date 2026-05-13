from django.db import migrations


def migrate_admin_to_new_roles(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    for user in User.objects.filter(role='admin'):
        if user.hospital_id is None:
            user.role = 'system_admin'
        else:
            user.role = 'hospital_admin'
        user.save(update_fields=['role'])


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0004_alter_user_role'),
    ]

    operations = [
        migrations.RunPython(migrate_admin_to_new_roles, migrations.RunPython.noop),
    ]
