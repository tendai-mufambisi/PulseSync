from datetime import date
from django.core.management.base import BaseCommand
from apps.accounts.models import User, Role
from apps.hospitals.models import Hospital
from apps.patients.models import Patient


DEMO_PASSWORD = 'Passw0rd!'


class Command(BaseCommand):
    help = 'Seed demo hospitals, users, and patients'

    def handle(self, *args, **options):
        # Hospitals
        parirenyatwa, _ = Hospital.objects.get_or_create(
            name='Parirenyatwa Group of Hospitals',
            defaults={'location': 'Harare, Zimbabwe', 'phone': '+263 4 794 411'},
        )
        gweru, _ = Hospital.objects.get_or_create(
            name='Gweru Provincial Hospital',
            defaults={'location': 'Gweru, Midlands', 'phone': '+263 54 222 402'},
        )
        self.stdout.write(f'  Hospital: {parirenyatwa.name}')
        self.stdout.write(f'  Hospital: {gweru.name}')

        # Users
        admin = self._upsert_user(
            'admin@demo.test', 'Admin Demo', Role.ADMIN,
            hospital=None, is_staff=True, is_superuser=True,
        )
        self._upsert_user(
            'hadmin@demo.test', 'Parirenyatwa Admin', Role.ADMIN,
            hospital=parirenyatwa,
        )
        self._upsert_user(
            'doctor@demo.test', 'Dr. Jane Smith', Role.DOCTOR,
            hospital=parirenyatwa,
        )
        self._upsert_user(
            'nurse@demo.test', 'Nurse John Doe', Role.NURSE,
            hospital=parirenyatwa,
        )
        self._upsert_user(
            'doctor2@demo.test', 'Dr. Tendai Moyo', Role.DOCTOR,
            hospital=gweru,
        )

        # Patients
        demo_patients = [
            dict(
                national_id='63-2400001A11',
                full_name='Alice Dube',
                date_of_birth=date(1985, 3, 15),
                gender='female',
                blood_type='A+',
                allergies='Penicillin, Shellfish',
                critical_conditions='Diabetes Type 2',
                emergency_contact='Bob Dube: +263 77 123 4567',
                hiv_status='negative',
                notes='Requires quarterly HbA1c checks.',
            ),
            dict(
                national_id='63-2400002B22',
                full_name='Robert Chikwanda',
                date_of_birth=date(1972, 8, 22),
                gender='male',
                blood_type='O+',
                allergies='Aspirin',
                critical_conditions='Hypertension',
                emergency_contact='Mary Chikwanda: +263 77 234 5678',
                hiv_status='negative',
                notes='',
            ),
            dict(
                national_id='63-2400003C33',
                full_name='Fatima Ncube',
                date_of_birth=date(1990, 11, 5),
                gender='female',
                blood_type='B-',
                allergies='',
                critical_conditions='Asthma',
                emergency_contact='Ahmed Ncube: +263 77 345 6789',
                hiv_status='positive',
                notes='Carries rescue inhaler at all times.',
            ),
        ]

        doctor = User.objects.get(email='doctor@demo.test')
        for p in demo_patients:
            patient, created = Patient.objects.get_or_create(
                national_id=p['national_id'],
                defaults={**p, 'created_by': doctor, 'hospital': parirenyatwa},
            )
            if not created and patient.hospital != parirenyatwa:
                patient.hospital = parirenyatwa
                patient.save(update_fields=['hospital'])

        self.stdout.write(self.style.SUCCESS('\nSeed complete!'))
        self.stdout.write('  admin@demo.test    / Passw0rd!  (system admin, no hospital)')
        self.stdout.write('  hadmin@demo.test   / Passw0rd!  (hospital admin, Parirenyatwa)')
        self.stdout.write('  doctor@demo.test   / Passw0rd!  (Parirenyatwa)')
        self.stdout.write('  nurse@demo.test    / Passw0rd!  (Parirenyatwa)')
        self.stdout.write('  doctor2@demo.test  / Passw0rd!  (Gweru Provincial)')

    def _upsert_user(self, email, full_name, role, hospital, **flags):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'full_name': full_name, 'role': role, 'hospital': hospital, **flags},
        )
        if not created:
            for k, v in {'full_name': full_name, 'role': role, 'hospital': hospital, **flags}.items():
                setattr(user, k, v)
        user.set_password(DEMO_PASSWORD)
        user.save()
        action = 'Created' if created else 'Updated'
        self.stdout.write(f'  {action}: {email}')
        return user
