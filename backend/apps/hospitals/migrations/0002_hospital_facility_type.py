from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospitals', '0001_add_hospital'),
    ]

    operations = [
        migrations.AddField(
            model_name='hospital',
            name='facility_type',
            field=models.CharField(
                choices=[
                    ('hospital', 'Hospital'),
                    ('clinic', 'Clinic'),
                    ('health_center', 'Health Center'),
                    ('pharmacy', 'Pharmacy'),
                    ('laboratory', 'Laboratory'),
                    ('other', 'Other'),
                ],
                default='hospital',
                max_length=50,
            ),
        ),
    ]
