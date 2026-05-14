from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hospitals', '0002_hospital_facility_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='hospital',
            name='facility_type_other',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
