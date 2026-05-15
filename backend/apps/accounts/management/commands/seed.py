from datetime import date
from django.core.management.base import BaseCommand
from apps.accounts.models import User, Role
from apps.hospitals.models import Hospital
from apps.patients.models import Patient, HealthEvent


DEMO_PASSWORD = 'Passw0rd!'


class Command(BaseCommand):
    help = 'Seed demo hospitals, users, patients, and health events (Zimbabwe context)'

    def handle(self, *args, **options):
        self.stdout.write('Seeding hospitals...')
        h = self._seed_hospitals()

        self.stdout.write('\nSeeding users...')
        u = self._seed_users(h)

        self.stdout.write('\nSeeding patients...')
        patients = self._seed_patients(h, u)

        self.stdout.write('\nSeeding health events...')
        self._seed_health_events(patients, h, u)

        self._print_summary()

    # ── Hospitals ─────────────────────────────────────────────────────────────

    def _seed_hospitals(self):
        specs = [
            ('Parirenyatwa Group of Hospitals',  'hospital',      'Mazowe Street, Harare',                '+263 4 794 411'),
            ('Harare Central Hospital',          'hospital',      'Lobengula Road, Harare',               '+263 4 621 355'),
            ('Mpilo Central Hospital',           'hospital',      'Mpilo Boulevard, Bulawayo',            '+263 9 282 000'),
            ('Gweru Provincial Hospital',        'hospital',      'Robert Mugabe Way, Gweru',             '+263 54 222 402'),
            ('Chitungwiza Central Hospital',     'hospital',      'Unit K, Chitungwiza',                  '+263 270 23 482'),
            ('Mutare Provincial Hospital',       'hospital',      'Herbert Chitepo Street, Mutare',       '+263 20 60071'),
            ('Masvingo Provincial Hospital',     'hospital',      'Hughes Street, Masvingo',              '+263 39 262 402'),
            ('Karanda Mission Hospital',         'health_center', 'Mount Darwin, Mashonaland Central',    '+263 75 293 4100'),
        ]
        result = {}
        for name, ftype, location, phone in specs:
            obj, _ = Hospital.objects.get_or_create(
                name=name,
                defaults={'facility_type': ftype, 'location': location, 'phone': phone},
            )
            result[name] = obj
            self.stdout.write(f'  Hospital: {name}')
        return result

    # ── Users ──────────────────────────────────────────────────────────────────

    def _seed_users(self, h):
        pari   = h['Parirenyatwa Group of Hospitals']
        harare = h['Harare Central Hospital']
        mpilo  = h['Mpilo Central Hospital']
        gweru  = h['Gweru Provincial Hospital']
        chitu  = h['Chitungwiza Central Hospital']
        mutare = h['Mutare Provincial Hospital']
        masv   = h['Masvingo Provincial Hospital']

        specs = [
            # email                              full_name                      role                    hospital  staff  super
            ('admin@demo.test',                  'Admin Demo',                  Role.SYSTEM_ADMIN,      None,     True,  True),

            # Parirenyatwa
            ('pari.admin@demo.test',             'Mrs Grace Choto',             Role.HOSPITAL_ADMIN,    pari,     False, False),
            ('dr.muromo@demo.test',              'Dr Tendai Muromo',            Role.DOCTOR,            pari,     False, False),
            ('dr.ncube.s@demo.test',             'Dr Sekai Ncube',              Role.DOCTOR,            pari,     False, False),
            ('sr.makoni@demo.test',              'Sr Rudo Makoni',              Role.NURSE,             pari,     False, False),
            ('nurse.tapiwa@demo.test',           'Nurse Tapiwa Mhuri',         Role.NURSE,             pari,     False, False),

            # Harare Central
            ('harare.admin@demo.test',           'Mr Kudzai Madhuku',           Role.HOSPITAL_ADMIN,    harare,   False, False),
            ('dr.mutasa@demo.test',              'Dr Simbarashe Mutasa',        Role.DOCTOR,            harare,   False, False),
            ('nurse.vimbai@demo.test',           'Nurse Vimbai Gumbo',         Role.NURSE,             harare,   False, False),

            # Mpilo
            ('mpilo.admin@demo.test',            'Mr Nkosana Ndlovu',           Role.HOSPITAL_ADMIN,    mpilo,    False, False),
            ('dr.mpofu@demo.test',               'Dr Sipho Mpofu',              Role.DOCTOR,            mpilo,    False, False),
            ('dr.dube@demo.test',                'Dr Bongani Dube',             Role.DOCTOR,            mpilo,    False, False),
            ('sr.sibongile@demo.test',           'Sr Sibongile Nkomo',          Role.NURSE,             mpilo,    False, False),

            # Gweru
            ('gweru.admin@demo.test',            'Mrs Patience Mushonga',       Role.HOSPITAL_ADMIN,    gweru,    False, False),
            ('dr.zimuto@demo.test',              'Dr Farai Zimuto',             Role.DOCTOR,            gweru,    False, False),
            ('nurse.tatenda@demo.test',          'Nurse Tatenda Chikwanda',    Role.NURSE,             gweru,    False, False),

            # Chitungwiza
            ('chitu.admin@demo.test',            'Mr Anesu Chikowero',          Role.HOSPITAL_ADMIN,    chitu,    False, False),
            ('dr.zhakata@demo.test',             'Dr Nobukhosi Zhakata',        Role.DOCTOR,            chitu,    False, False),

            # Mutare
            ('mutare.admin@demo.test',           'Mrs Rutendo Chimombe',        Role.HOSPITAL_ADMIN,    mutare,   False, False),
            ('dr.mukwambo@demo.test',            'Dr Ngonidzashe Mukwambo',     Role.DOCTOR,            mutare,   False, False),

            # Masvingo
            ('masv.admin@demo.test',             'Mr Tinotenda Marufu',         Role.HOSPITAL_ADMIN,    masv,     False, False),
            ('dr.musikavanhu@demo.test',         'Dr Chipo Musikavanhu',        Role.DOCTOR,            masv,     False, False),
        ]

        result = {}
        for email, full_name, role, hospital, is_staff, is_superuser in specs:
            user = self._upsert_user(
                email, full_name, role, hospital,
                is_staff=is_staff, is_superuser=is_superuser,
            )
            result[email] = user
        return result

    # ── Patients ───────────────────────────────────────────────────────────────

    def _seed_patients(self, h, u):
        pari   = h['Parirenyatwa Group of Hospitals']
        harare = h['Harare Central Hospital']
        mpilo  = h['Mpilo Central Hospital']
        gweru  = h['Gweru Provincial Hospital']
        chitu  = h['Chitungwiza Central Hospital']
        mutare = h['Mutare Provincial Hospital']
        masv   = h['Masvingo Provincial Hospital']

        dr_muromo    = u['dr.muromo@demo.test']
        dr_ncube     = u['dr.ncube.s@demo.test']
        dr_mutasa    = u['dr.mutasa@demo.test']
        dr_mpofu     = u['dr.mpofu@demo.test']
        dr_dube      = u['dr.dube@demo.test']
        dr_zimuto    = u['dr.zimuto@demo.test']
        dr_zhakata   = u['dr.zhakata@demo.test']
        dr_mukwambo  = u['dr.mukwambo@demo.test']
        dr_musika    = u['dr.musikavanhu@demo.test']

        # National ID format: \d{2}-\d{7}[A-Za-z]\d{2}
        # District codes: 63=Harare, 02=Bulawayo, 50=Gweru, 22=Mutare, 05=Chitungwiza, 30=Masvingo
        specs = [
            # ── Parirenyatwa ────────────────────────────────────────────────
            dict(
                national_id='63-1985015A63', full_name='Rudo Choto',
                date_of_birth=date(1985, 3, 12), gender='female', blood_type='A+',
                allergies='Penicillin',
                chronic_conditions='Diabetes mellitus type 2, Hypertension',
                existing_medications='Metformin 500mg BD, Amlodipine 5mg OD',
                hiv_status='Negative',
                next_of_kin_name='Tawanda Choto', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 77 234 5601',
                emergency_contact='Tawanda Choto: +263 77 234 5601',
                hospital=pari, created_by=dr_muromo,
            ),
            dict(
                national_id='63-1978089B63', full_name='Takudzwa Moyo',
                date_of_birth=date(1978, 9, 4), gender='male', blood_type='O+',
                allergies='',
                critical_conditions='Pulmonary tuberculosis (smear positive)',
                chronic_conditions='HIV positive',
                existing_medications='RHZE regimen, ART (DTG/TDF/3TC)',
                hiv_status='Positive',
                next_of_kin_name='Agnes Moyo', next_of_kin_relationship='Sister',
                next_of_kin_phone='+263 71 456 7890',
                emergency_contact='Agnes Moyo: +263 71 456 7890',
                hospital=pari, created_by=dr_muromo,
            ),
            dict(
                national_id='63-1992107C63', full_name='Tsitsi Mhuri',
                date_of_birth=date(1992, 6, 22), gender='female', blood_type='B+',
                allergies='NSAIDs',
                chronic_conditions='Bronchial asthma',
                existing_medications='Salbutamol inhaler PRN, Fluticasone 100mcg BD',
                hiv_status='Negative',
                next_of_kin_name='Blessing Mhuri', next_of_kin_relationship='Mother',
                next_of_kin_phone='+263 77 901 2345',
                emergency_contact='Blessing Mhuri: +263 77 901 2345',
                hospital=pari, created_by=dr_ncube,
            ),
            dict(
                national_id='63-1965043D63', full_name='Munyaradzi Zimuto',
                date_of_birth=date(1965, 11, 17), gender='male', blood_type='AB+',
                allergies='Sulphonamides',
                chronic_conditions='Benign prostatic hyperplasia, Hypertension',
                existing_medications='Tamsulosin 0.4mg OD, Enalapril 10mg OD',
                hiv_status='Negative',
                past_surgeries='Appendicectomy (1998)',
                next_of_kin_name='Miriam Zimuto', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 73 112 2334',
                emergency_contact='Miriam Zimuto: +263 73 112 2334',
                hospital=pari, created_by=dr_muromo,
            ),
            # Newborn — no national ID, guardian details required
            dict(
                registration_type='newborn', national_id=None, full_name='Baby Shumba',
                date_of_birth=date(2024, 5, 22), gender='male', blood_type='unknown',
                guardian_name='Chenai Shumba', guardian_relationship='Mother',
                guardian_national_id='63-1997221E63', guardian_contact='+263 77 556 6778',
                emergency_contact='Chenai Shumba: +263 77 556 6778',
                hospital=pari, created_by=dr_ncube,
            ),

            # ── Harare Central ──────────────────────────────────────────────
            dict(
                national_id='63-1990156E63', full_name='Tatenda Madhuku',
                date_of_birth=date(1990, 1, 30), gender='male', blood_type='O-',
                allergies='',
                chronic_conditions='',
                hiv_status='Negative',
                next_of_kin_name='Farai Madhuku', next_of_kin_relationship='Brother',
                next_of_kin_phone='+263 71 223 3445',
                emergency_contact='Farai Madhuku: +263 71 223 3445',
                hospital=harare, created_by=dr_mutasa,
            ),
            dict(
                national_id='63-2001234F63', full_name='Chiedza Nyathi',
                date_of_birth=date(2001, 7, 8), gender='female', blood_type='A-',
                allergies='',
                hiv_status='Negative',
                next_of_kin_name='Josephine Nyathi', next_of_kin_relationship='Mother',
                next_of_kin_phone='+263 77 334 4556',
                emergency_contact='Josephine Nyathi: +263 77 334 4556',
                hospital=harare, created_by=dr_mutasa,
            ),
            dict(
                national_id='63-1958321G63', full_name='Shingirai Marufu',
                date_of_birth=date(1958, 4, 3), gender='male', blood_type='B+',
                allergies='',
                critical_conditions='Atrial fibrillation, Congestive cardiac failure',
                chronic_conditions='Atrial fibrillation, Congestive cardiac failure NYHA Class III',
                existing_medications='Digoxin 0.125mg OD, Furosemide 40mg OD, Warfarin 3mg OD',
                hiv_status='Negative',
                past_surgeries='Coronary angioplasty (2015)',
                next_of_kin_name='Rutendo Marufu', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 73 445 5667',
                emergency_contact='Rutendo Marufu: +263 73 445 5667',
                hospital=harare, created_by=dr_mutasa,
            ),

            # ── Mpilo ───────────────────────────────────────────────────────
            dict(
                national_id='02-1970067A02', full_name='Nkosana Sibanda',
                date_of_birth=date(1970, 5, 19), gender='male', blood_type='O+',
                allergies='Metformin (GI intolerance)',
                chronic_conditions='Hypertension, Diabetes mellitus type 2',
                existing_medications='Enalapril 10mg BD, Glibenclamide 5mg OD',
                hiv_status='Negative',
                next_of_kin_name='Nomvula Sibanda', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 77 556 7889',
                emergency_contact='Nomvula Sibanda: +263 77 556 7889',
                hospital=mpilo, created_by=dr_mpofu,
            ),
            dict(
                national_id='02-1988123B02', full_name='Sibongile Mhlanga',
                date_of_birth=date(1988, 10, 14), gender='female', blood_type='B-',
                allergies='',
                critical_conditions='Sickle cell disease (HbSS)',
                chronic_conditions='Sickle cell disease (HbSS)',
                existing_medications='Hydroxyurea 500mg OD, Folic acid 5mg OD',
                hiv_status='Negative',
                next_of_kin_name='Bongani Mhlanga', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 71 667 8900',
                emergency_contact='Bongani Mhlanga: +263 71 667 8900',
                hospital=mpilo, created_by=dr_mpofu,
            ),
            dict(
                national_id='02-1995089C02', full_name='Sipho Ndlovu',
                date_of_birth=date(1995, 3, 27), gender='male', blood_type='A+',
                allergies='',
                hiv_status='Negative',
                next_of_kin_name='Lungile Ndlovu', next_of_kin_relationship='Mother',
                next_of_kin_phone='+263 77 778 8901',
                emergency_contact='Lungile Ndlovu: +263 77 778 8901',
                hospital=mpilo, created_by=dr_dube,
            ),
            dict(
                national_id='02-1982178D02', full_name='Lungile Nkomo',
                date_of_birth=date(1982, 8, 5), gender='female', blood_type='O+',
                allergies='Cotrimoxazole',
                chronic_conditions='HIV positive, on ART',
                existing_medications='DTG/TDF/3TC once daily',
                hiv_status='Positive',
                next_of_kin_name='Thandeka Nkomo', next_of_kin_relationship='Sister',
                next_of_kin_phone='+263 73 889 9012',
                emergency_contact='Thandeka Nkomo: +263 73 889 9012',
                hospital=mpilo, created_by=dr_dube,
            ),

            # ── Gweru ───────────────────────────────────────────────────────
            dict(
                national_id='50-1988234A50', full_name='Farai Chikuni',
                date_of_birth=date(1988, 2, 14), gender='male', blood_type='B+',
                allergies='',
                hiv_status='Negative',
                next_of_kin_name='Mavis Chikuni', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 71 990 0123',
                emergency_contact='Mavis Chikuni: +263 71 990 0123',
                hospital=gweru, created_by=dr_zimuto,
            ),
            dict(
                national_id='50-1975345B50', full_name='Patience Chikwanda',
                date_of_birth=date(1975, 12, 1), gender='female', blood_type='A+',
                allergies='',
                chronic_conditions='Hypertension',
                existing_medications='Nifedipine LA 30mg OD',
                hiv_status='Negative',
                next_of_kin_name='Clive Chikwanda', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 77 001 1234',
                emergency_contact='Clive Chikwanda: +263 77 001 1234',
                hospital=gweru, created_by=dr_zimuto,
            ),

            # ── Chitungwiza ─────────────────────────────────────────────────
            dict(
                national_id='05-2003456A05', full_name='Tinashe Mutasa',
                date_of_birth=date(2003, 6, 9), gender='male', blood_type='O+',
                allergies='',
                hiv_status='Negative',
                next_of_kin_name='Josephat Mutasa', next_of_kin_relationship='Father',
                next_of_kin_phone='+263 71 112 2345',
                emergency_contact='Josephat Mutasa: +263 71 112 2345',
                hospital=chitu, created_by=dr_zhakata,
            ),
            dict(
                national_id='05-1997012B05', full_name='Vimbai Zvenyika',
                date_of_birth=date(1997, 9, 18), gender='female', blood_type='AB+',
                allergies='',
                chronic_conditions='G2P1 — 28 weeks gestation',
                hiv_status='Negative',
                next_of_kin_name='Tapiwa Zvenyika', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 77 223 3456',
                emergency_contact='Tapiwa Zvenyika: +263 77 223 3456',
                hospital=chitu, created_by=dr_zhakata,
            ),

            # ── Mutare ──────────────────────────────────────────────────────
            dict(
                national_id='22-1980567A22', full_name='Chenai Musasa',
                date_of_birth=date(1980, 4, 25), gender='female', blood_type='A-',
                allergies='',
                hiv_status='Negative',
                next_of_kin_name='Takudzwa Musasa', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 73 334 4567',
                emergency_contact='Takudzwa Musasa: +263 73 334 4567',
                hospital=mutare, created_by=dr_mukwambo,
            ),
            dict(
                national_id='22-1988678B22', full_name='Tonderai Nyamukapa',
                date_of_birth=date(1988, 11, 3), gender='male', blood_type='O-',
                allergies='',
                chronic_conditions='Peptic ulcer disease',
                existing_medications='Omeprazole 20mg OD, Amoxicillin 1g BD (H. pylori eradication completed)',
                hiv_status='Negative',
                next_of_kin_name='Grace Nyamukapa', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 77 445 5678',
                emergency_contact='Grace Nyamukapa: +263 77 445 5678',
                hospital=mutare, created_by=dr_mukwambo,
            ),

            # ── Masvingo ────────────────────────────────────────────────────
            dict(
                national_id='30-1972456A30', full_name='Kudzai Zvobgo',
                date_of_birth=date(1972, 7, 16), gender='male', blood_type='B+',
                allergies='',
                chronic_conditions='Type 2 diabetes mellitus, Diabetic neuropathy',
                existing_medications='Insulin glargine 20 units nocte, Pregabalin 75mg BD',
                hiv_status='Negative',
                past_surgeries='Below-knee amputation right limb (2022)',
                next_of_kin_name='Mavis Zvobgo', next_of_kin_relationship='Spouse',
                next_of_kin_phone='+263 71 556 6789',
                emergency_contact='Mavis Zvobgo: +263 71 556 6789',
                hospital=masv, created_by=dr_musika,
            ),
        ]

        result = {}
        for p in specs:
            hospital  = p.pop('hospital')
            created_by = p.pop('created_by')
            nat_id    = p.get('national_id')
            reg_type  = p.get('registration_type', 'existing')

            if nat_id:
                patient, created = Patient.objects.get_or_create(
                    national_id=nat_id,
                    defaults={**p, 'registration_type': reg_type, 'hospital': hospital, 'created_by': created_by},
                )
            else:
                # Newborn — match by name + DOB since no national ID
                patient, created = Patient.objects.get_or_create(
                    full_name=p['full_name'],
                    date_of_birth=p['date_of_birth'],
                    defaults={**p, 'hospital': hospital, 'created_by': created_by},
                )

            if not created and patient.hospital != hospital:
                patient.hospital = hospital
                patient.save(update_fields=['hospital'])

            result[p['full_name']] = patient
            action = 'Created' if created else 'Exists '
            self.stdout.write(f'  {action}: {p["full_name"]}')

        return result

    # ── Health Events ──────────────────────────────────────────────────────────

    def _seed_health_events(self, pts, h, u):
        pari   = h['Parirenyatwa Group of Hospitals']
        harare = h['Harare Central Hospital']
        mpilo  = h['Mpilo Central Hospital']
        gweru  = h['Gweru Provincial Hospital']
        chitu  = h['Chitungwiza Central Hospital']
        mutare = h['Mutare Provincial Hospital']
        masv   = h['Masvingo Provincial Hospital']

        dr_muromo   = u['dr.muromo@demo.test']
        dr_ncube    = u['dr.ncube.s@demo.test']
        dr_mutasa   = u['dr.mutasa@demo.test']
        dr_mpofu    = u['dr.mpofu@demo.test']
        dr_dube     = u['dr.dube@demo.test']
        dr_zimuto   = u['dr.zimuto@demo.test']
        dr_zhakata  = u['dr.zhakata@demo.test']
        dr_mukwambo = u['dr.mukwambo@demo.test']
        dr_musika   = u['dr.musikavanhu@demo.test']

        events = [
            # ── Rudo Choto (diabetes + hypertension) ────────────────────────
            dict(
                patient=pts['Rudo Choto'], event_type='consultation',
                event_date=date(2024, 1, 15), hospital=pari, clinician=dr_muromo,
                summary='Initial presentation with polyuria, polydipsia, and fatigue. '
                        'BP 152/96 mmHg. Fasting blood glucose 14.2 mmol/L. BMI 29.4.',
                created_by=dr_muromo,
            ),
            dict(
                patient=pts['Rudo Choto'], event_type='diagnosis',
                event_date=date(2024, 1, 15), hospital=pari, clinician=dr_muromo,
                diagnosis='Diabetes mellitus type 2. Hypertension grade 2.',
                summary='HbA1c 9.8%. Urine dipstick negative for protein. Fundoscopy: no retinopathy.',
                created_by=dr_muromo,
            ),
            dict(
                patient=pts['Rudo Choto'], event_type='medication',
                event_date=date(2024, 1, 20), hospital=pari, clinician=dr_muromo,
                medications='Metformin 500mg BD (uptitrate to 1g BD after 2 weeks). '
                            'Amlodipine 5mg OD. Low-dose aspirin 75mg OD.',
                summary='Lifestyle counselling given. Dietary referral made. 3-month review scheduled.',
                created_by=dr_muromo,
            ),
            dict(
                patient=pts['Rudo Choto'], event_type='consultation',
                event_date=date(2024, 4, 22), hospital=pari, clinician=dr_muromo,
                summary='3-month review. BP 136/84. FBG 8.1 mmol/L. Patient tolerating medications well. '
                        'Adherent to lifestyle changes. Continue current regimen.',
                created_by=dr_muromo,
            ),

            # ── Takudzwa Moyo (TB + HIV) ─────────────────────────────────────
            dict(
                patient=pts['Takudzwa Moyo'], event_type='sensitive',
                event_date=date(2024, 2, 10), hospital=pari, clinician=dr_muromo,
                is_sensitive=True, sensitive_category='hiv',
                summary='HIV rapid test positive. Confirmatory test (Unigold) positive. '
                        'Pre-ART CD4 count: 210 cells/µL. WHO Stage III. '
                        'Counselling provided. Patient consented to ART initiation after TB treatment started.',
                created_by=dr_muromo,
            ),
            dict(
                patient=pts['Takudzwa Moyo'], event_type='diagnosis',
                event_date=date(2024, 2, 12), hospital=pari, clinician=dr_muromo,
                diagnosis='Pulmonary tuberculosis (smear positive — 2+ AFB). HIV positive, WHO Stage III.',
                summary='CXR: bilateral upper lobe infiltrates with cavitation. Sputum AFB positive x2. '
                        'GeneXpert: MTB detected, rifampicin sensitive. '
                        'ESR 95. Weight 58kg (BMI 19.1). No drug resistance identified.',
                created_by=dr_muromo,
            ),
            dict(
                patient=pts['Takudzwa Moyo'], event_type='medication',
                event_date=date(2024, 2, 15), hospital=pari, clinician=dr_muromo,
                medications='Intensive phase: RHZE (Rifampicin 600mg, Isoniazid 300mg, '
                            'Pyrazinamide 1500mg, Ethambutol 1200mg) daily x2 months. '
                            'ART to be initiated after 2 weeks: DTG/TDF/3TC OD. '
                            'Pyridoxine 25mg OD (INH neuropathy prophylaxis). '
                            'Cotrimoxazole 960mg OD (prophylaxis).',
                summary='Patient enrolled in TB/HIV co-treatment programme. '
                        'DOT (directly observed therapy) arranged at nearest clinic.',
                created_by=dr_muromo,
            ),

            # ── Tsitsi Mhuri (asthma) ─────────────────────────────────────────
            dict(
                patient=pts['Tsitsi Mhuri'], event_type='consultation',
                event_date=date(2024, 3, 5), hospital=pari, clinician=dr_ncube,
                summary='Recurrent wheeze and dyspnoea on exertion for 3 years. '
                        'Peak expiratory flow variability >25%. Spirometry: FEV1/FVC 0.64 (reversible). '
                        'Diagnosed moderate persistent asthma. Inhaler technique assessed and corrected.',
                created_by=dr_ncube,
            ),
            dict(
                patient=pts['Tsitsi Mhuri'], event_type='emergency',
                event_date=date(2024, 8, 14), hospital=pari, clinician=dr_ncube,
                summary='Acute severe asthmatic attack following exposure to dust at work. '
                        'O2 saturation 87% on air. Respiratory rate 32/min. Unable to complete sentences. '
                        'Nebulised salbutamol 5mg x3 + ipratropium 500mcg x2. IV hydrocortisone 200mg. '
                        'O2 sats improved to 97%. Admitted to medical ward for observation.',
                initial_observations='PEFR <33% predicted. Widespread expiratory wheeze bilaterally.',
                created_by=dr_ncube,
            ),

            # ── Munyaradzi Zimuto (BPH + hypertension) ───────────────────────
            dict(
                patient=pts['Munyaradzi Zimuto'], event_type='consultation',
                event_date=date(2023, 11, 20), hospital=pari, clinician=dr_muromo,
                summary='Nocturia x4, hesitancy, weak urinary stream and terminal dribbling for 18 months. '
                        'IPSS score 22 (severe). DRE: smooth, symmetrically enlarged prostate, '
                        'approx 40g, non-tender, no nodules. PSA 3.2 ng/mL.',
                created_by=dr_muromo,
            ),
            dict(
                patient=pts['Munyaradzi Zimuto'], event_type='diagnosis',
                event_date=date(2023, 11, 20), hospital=pari, clinician=dr_muromo,
                diagnosis='Benign prostatic hyperplasia (BPH). Hypertension.',
                summary='USS kidneys and bladder: residual urine 85mL, bilateral mild hydronephrosis. '
                        'Referred urology for further management.',
                created_by=dr_muromo,
            ),
            dict(
                patient=pts['Munyaradzi Zimuto'], event_type='medication',
                event_date=date(2023, 11, 25), hospital=pari, clinician=dr_muromo,
                medications='Tamsulosin 0.4mg OD nocte. Enalapril 10mg OD. '
                            'Review in 6 weeks or sooner if symptoms worsen.',
                created_by=dr_muromo,
            ),

            # ── Baby Shumba (birth) ──────────────────────────────────────────
            dict(
                patient=pts['Baby Shumba'], event_type='birth',
                event_date=date(2024, 5, 22), hospital=pari, clinician=dr_ncube,
                birth_weight_kg='3.200', delivery_type='normal', gestational_age_weeks=39,
                apgar_score=9,
                birth_complications='',
                initial_observations='Male infant born in good condition. Cried immediately. '
                                     'Skin colour pink. Tone and reflexes normal. '
                                     'Eye prophylaxis (tetracycline) applied. '
                                     'Vitamin K 1mg IM given. Birth notified.',
                summary='Spontaneous vaginal delivery at 39 weeks. No complications. '
                        'Mother G2P2. PMTCT: mother on ART, infant given Nevirapine prophylaxis.',
                created_by=dr_ncube,
            ),

            # ── Tatenda Madhuku (malaria) ─────────────────────────────────────
            dict(
                patient=pts['Tatenda Madhuku'], event_type='diagnosis',
                event_date=date(2024, 7, 3), hospital=harare, clinician=dr_mutasa,
                diagnosis='Plasmodium falciparum malaria (uncomplicated).',
                summary='Fever, chills, and headache for 3 days. RDT positive (P. falciparum). '
                        'Blood film: P. falciparum, parasitaemia 1.2%. '
                        'Temp 39.2°C. Haemoglobin 10.8 g/dL. No signs of severe malaria.',
                created_by=dr_mutasa,
            ),
            dict(
                patient=pts['Tatenda Madhuku'], event_type='medication',
                event_date=date(2024, 7, 3), hospital=harare, clinician=dr_mutasa,
                medications='Artemether-lumefantrine (AL) 80/480mg — 6 doses over 3 days '
                            '(20/120mg x4 tablets twice daily). Paracetamol 1g TDS PRN. '
                            'Oral rehydration. Review after completion of course.',
                summary='Reviewed day 3. Afebrile. Symptoms resolved. Repeat film negative.',
                created_by=dr_mutasa,
            ),

            # ── Chiedza Nyathi (trauma – road traffic accident) ───────────────
            dict(
                patient=pts['Chiedza Nyathi'], event_type='emergency',
                event_date=date(2024, 6, 18), hospital=harare, clinician=dr_mutasa,
                summary='Road traffic accident (pedestrian struck by vehicle). '
                        'Closed fracture left femur (mid-shaft). Laceration right scalp 4cm. '
                        'GCS 15/15. Haemodynamically stable after 1L IV crystalloid. '
                        'Neurovascular status intact distally. X-ray confirmed. '
                        'Orthopaedics consulted — surgical fixation planned.',
                initial_observations='BP 100/68 → 118/76 post-resuscitation. HR 110. '
                                     'Splinted in Thomas splint. IV morphine 5mg given.',
                created_by=dr_mutasa,
            ),

            # ── Shingirai Marufu (cardiac) ────────────────────────────────────
            dict(
                patient=pts['Shingirai Marufu'], event_type='consultation',
                event_date=date(2024, 2, 28), hospital=harare, clinician=dr_mutasa,
                summary='Progressive dyspnoea on minimal exertion, orthopnoea, and bilateral ankle oedema '
                        'for 6 weeks. ECG: atrial fibrillation, rate 128 bpm. '
                        'CXR: cardiomegaly, bilateral pleural effusions. '
                        'Echo (bedside): severely impaired LV function, EF estimated 25-30%.',
                created_by=dr_mutasa,
            ),
            dict(
                patient=pts['Shingirai Marufu'], event_type='diagnosis',
                event_date=date(2024, 2, 28), hospital=harare, clinician=dr_mutasa,
                diagnosis='Atrial fibrillation with rapid ventricular response. '
                          'Congestive cardiac failure, NYHA Class III.',
                summary='Thyroid function normal. INR 1.1. Electrolytes normal. '
                        'Troponin negative. Admitted for rate control and diuresis.',
                created_by=dr_mutasa,
            ),
            dict(
                patient=pts['Shingirai Marufu'], event_type='medication',
                event_date=date(2024, 3, 1), hospital=harare, clinician=dr_mutasa,
                medications='Digoxin 0.125mg OD. Furosemide 40mg OD. '
                            'Spironolactone 25mg OD. Warfarin 3mg OD (target INR 2-3). '
                            'Carvedilol 3.125mg BD (initiated low-dose, uptitrate slowly). '
                            'Strict fluid restriction 1.5L/day. Daily weights.',
                summary='Rate controlled to 78 bpm by day 2. Weight loss of 3.2kg over 4 days '
                        '(diuresis). Discharged with cardiology follow-up in 2 weeks.',
                created_by=dr_mutasa,
            ),

            # ── Nkosana Sibanda (hypertension + diabetes) ─────────────────────
            dict(
                patient=pts['Nkosana Sibanda'], event_type='consultation',
                event_date=date(2024, 4, 10), hospital=mpilo, clinician=dr_mpofu,
                summary='Routine chronic disease review. BP 165/102 mmHg. '
                        'Random blood glucose 12.8 mmol/L. Weight 91kg, BMI 31.2. '
                        'Feet examined — no peripheral neuropathy detected. Urine ACR elevated (3.2 mg/mmol).',
                created_by=dr_mpofu,
            ),
            dict(
                patient=pts['Nkosana Sibanda'], event_type='diagnosis',
                event_date=date(2024, 4, 10), hospital=mpilo, clinician=dr_mpofu,
                diagnosis='Hypertension (grade 2), inadequately controlled. '
                          'Diabetes mellitus type 2, inadequately controlled. '
                          'Early diabetic nephropathy (microalbuminuria).',
                created_by=dr_mpofu,
            ),
            dict(
                patient=pts['Nkosana Sibanda'], event_type='medication',
                event_date=date(2024, 4, 12), hospital=mpilo, clinician=dr_mpofu,
                medications='Enalapril 10mg BD (renoprotective). Glibenclamide 5mg OD. '
                            'Added: Amlodipine 5mg OD. '
                            'Counselled on Metformin intolerance — consider switch to low-dose if tolerated. '
                            'Dietary review and weight-loss target 5-10% set.',
                created_by=dr_mpofu,
            ),

            # ── Sibongile Mhlanga (sickle cell) ──────────────────────────────
            dict(
                patient=pts['Sibongile Mhlanga'], event_type='consultation',
                event_date=date(2024, 1, 8), hospital=mpilo, clinician=dr_mpofu,
                summary='Known sickle cell disease (HbSS). Presenting with severe bilateral leg pain '
                        'and low-grade fever (37.9°C) for 1 day. '
                        'Last admission for VOC was April 2023.',
                created_by=dr_mpofu,
            ),
            dict(
                patient=pts['Sibongile Mhlanga'], event_type='emergency',
                event_date=date(2024, 1, 8), hospital=mpilo, clinician=dr_mpofu,
                summary='Vaso-occlusive crisis (VOC). Pain score 9/10. '
                        'IV access established. IV morphine 5mg titrated. '
                        'IV fluids 3L over 24 hours. Oxygen 2L/min via nasal prongs. '
                        'Haemoglobin 7.2 g/dL — no exchange transfusion indicated currently. '
                        'Admitted to ward. Pain improved to 4/10 by 24 hours.',
                initial_observations='Temp 37.9°C. HR 108. BP 118/74. '
                                     'SpO2 96% on air → 99% on 2L O2. Jaundice mild.',
                created_by=dr_mpofu,
            ),

            # ── Sipho Ndlovu (malaria) ────────────────────────────────────────
            dict(
                patient=pts['Sipho Ndlovu'], event_type='diagnosis',
                event_date=date(2024, 8, 22), hospital=mpilo, clinician=dr_dube,
                diagnosis='Uncomplicated Plasmodium falciparum malaria.',
                summary='3-day history of fever, rigors, and myalgia. Returned from rural Matabeleland South '
                        '10 days prior. RDT positive (P. falciparum). '
                        'Blood film: ring forms 0.8% parasitaemia. No signs of severe malaria.',
                created_by=dr_dube,
            ),
            dict(
                patient=pts['Sipho Ndlovu'], event_type='medication',
                event_date=date(2024, 8, 22), hospital=mpilo, clinician=dr_dube,
                medications='Artemether-lumefantrine 80/480mg x6 doses (3-day course). '
                            'Paracetamol 500mg TDS PRN. Oral fluids encouraged.',
                summary='Day 3 review: afebrile, parasitaemia cleared on repeat film. '
                        'Patient discharged. Malaria prevention counselling given.',
                created_by=dr_dube,
            ),

            # ── Lungile Nkomo (HIV) ───────────────────────────────────────────
            dict(
                patient=pts['Lungile Nkomo'], event_type='sensitive',
                event_date=date(2024, 3, 15), hospital=mpilo, clinician=dr_dube,
                is_sensitive=True, sensitive_category='hiv',
                summary='HIV positive confirmed (ELISA + Unigold). CD4 count 350 cells/µL. '
                        'WHO Stage II. Viral load baseline 45,000 copies/mL. '
                        'Extensive counselling provided. Partner notification discussed. '
                        'Patient consented and ready to commence ART.',
                created_by=dr_dube,
            ),
            dict(
                patient=pts['Lungile Nkomo'], event_type='medication',
                event_date=date(2024, 3, 20), hospital=mpilo, clinician=dr_dube,
                medications='Dolutegravir + Tenofovir + Lamivudine (DTG/TDF/3TC) fixed-dose combination OD. '
                            'Cotrimoxazole 960mg OD (prophylaxis until CD4 >350 for 6 months). '
                            'Vitamins prescribed. Adherence counselling completed.',
                summary='Review at 4 weeks: tolerating ART well. No side effects. Adherent.',
                created_by=dr_dube,
            ),

            # ── Farai Chikuni (typhoid) ───────────────────────────────────────
            dict(
                patient=pts['Farai Chikuni'], event_type='diagnosis',
                event_date=date(2024, 9, 5), hospital=gweru, clinician=dr_zimuto,
                diagnosis='Typhoid fever (Salmonella typhi).',
                summary='5-day history of high fever (39.8°C), headache, relative bradycardia, '
                        'and rose spots on abdomen. Widal: H antigen 1:160, O antigen 1:320. '
                        'Blood culture sent. Haemoglobin 11.2 g/dL. WBC 3.8 x10⁹/L (leucopenia). '
                        'LFTs mildly elevated. No intestinal perforation signs.',
                created_by=dr_zimuto,
            ),
            dict(
                patient=pts['Farai Chikuni'], event_type='medication',
                event_date=date(2024, 9, 5), hospital=gweru, clinician=dr_zimuto,
                medications='Azithromycin 500mg OD x7 days. IV normal saline 2L/day. '
                            'Paracetamol 1g TDS for fever. Soft diet. '
                            'Strict hand hygiene measures. Contact tracing initiated.',
                summary='Blood culture confirmed S. typhi, sensitive to azithromycin and ciprofloxacin. '
                        'Afebrile by day 5. Discharged day 7. '
                        'WASH counselling provided to patient and family.',
                created_by=dr_zimuto,
            ),

            # ── Patience Chikwanda (hypertension) ─────────────────────────────
            dict(
                patient=pts['Patience Chikwanda'], event_type='consultation',
                event_date=date(2024, 5, 14), hospital=gweru, clinician=dr_zimuto,
                summary='Annual chronic disease review. BP 148/92 mmHg. Weight stable at 74kg. '
                        'No headaches, no visual disturbance. Urinalysis: no proteinuria. '
                        'Creatinine 88 µmol/L. Electrolytes normal. '
                        'Adherent to Nifedipine LA 30mg OD. Continue current management.',
                created_by=dr_zimuto,
            ),

            # ── Tinashe Mutasa (trauma) ───────────────────────────────────────
            dict(
                patient=pts['Tinashe Mutasa'], event_type='emergency',
                event_date=date(2024, 7, 20), hospital=chitu, clinician=dr_zhakata,
                summary='Motorcycle collision without helmet. Laceration right scalp (6cm, full thickness). '
                        'Contusion left knee. No loss of consciousness. GCS 15/15 throughout. '
                        'C-spine cleared clinically. CT head: no intracranial pathology. '
                        'Scalp wound irrigated and sutured under LA (6 x 2-0 nylon). '
                        'Knee X-ray: no bony injury. Discharged with head injury advice card.',
                initial_observations='BP 126/80. HR 92. Pupils equal and reactive. FAST scan negative.',
                created_by=dr_zhakata,
            ),

            # ── Vimbai Zvenyika (antenatal) ───────────────────────────────────
            dict(
                patient=pts['Vimbai Zvenyika'], event_type='consultation',
                event_date=date(2024, 8, 1), hospital=chitu, clinician=dr_zhakata,
                summary='Antenatal care visit at 28 weeks. G2P1, previous SVD. '
                        'BP 118/72 mmHg. Weight 68kg (pre-pregnancy 61kg, weight gain on track). '
                        'Symphysiofundal height 28cm. Fetal heartbeat 144bpm (Doppler). '
                        'Fetal movements present and good. '
                        'VDRL negative. Blood group O+. Hb 10.4 g/dL (mild anaemia). '
                        'HIV status: negative (retested). Urine: no proteinuria.',
                medications='Ferrous sulphate 200mg BD. Folic acid 5mg OD. '
                            'SP (sulfadoxine-pyrimethamine) IPTp given (2nd dose). '
                            'LLIN (insecticide-treated net) issued. '
                            'Next visit at 32 weeks. Danger signs reviewed.',
                created_by=dr_zhakata,
            ),

            # ── Chenai Musasa (cervical cancer screening) ──────────────────────
            dict(
                patient=pts['Chenai Musasa'], event_type='consultation',
                event_date=date(2024, 6, 10), hospital=mutare, clinician=dr_mukwambo,
                summary='Presenting for cervical cancer screening (VIA — visual inspection with acetic acid). '
                        'G3P3. Last Pap smear 2016, result not available. '
                        'VIA: acetowhite lesion at 6-oclock position adjacent to transformation zone. '
                        'Colposcopy referral made. '
                        'Counselled on findings. HPV status unknown.',
                created_by=dr_mukwambo,
            ),
            dict(
                patient=pts['Chenai Musasa'], event_type='sensitive',
                event_date=date(2024, 6, 10), hospital=mutare, clinician=dr_mukwambo,
                is_sensitive=True, sensitive_category='reproductive',
                summary='Colposcopy-directed biopsy taken. Histology pending. '
                        'Patient counselled on possibility of CIN II/III or early cervical carcinoma. '
                        'Emotional support provided. Husband notified with patient consent. '
                        'Follow-up in 2 weeks for histology result.',
                created_by=dr_mukwambo,
            ),

            # ── Tonderai Nyamukapa (PUD) ──────────────────────────────────────
            dict(
                patient=pts['Tonderai Nyamukapa'], event_type='diagnosis',
                event_date=date(2024, 4, 18), hospital=mutare, clinician=dr_mukwambo,
                diagnosis='Peptic ulcer disease (duodenal ulcer). H. pylori positive.',
                summary='3-month history of epigastric pain, worse at night and relieved by food. '
                        'OGD: 12mm duodenal ulcer (posterior wall). CLO test positive. '
                        'No bleeding stigmata. No perforation signs.',
                created_by=dr_mukwambo,
            ),
            dict(
                patient=pts['Tonderai Nyamukapa'], event_type='medication',
                event_date=date(2024, 4, 18), hospital=mutare, clinician=dr_mukwambo,
                medications='H. pylori eradication: Omeprazole 20mg BD + Amoxicillin 1g BD + '
                            'Clarithromycin 500mg BD x14 days. '
                            'Continue Omeprazole 20mg OD maintenance for 4 weeks post-eradication. '
                            'Avoid NSAIDs, alcohol, and smoking. '
                            'Urea breath test at 6 weeks post-treatment.',
                summary='Urea breath test at 6 weeks: negative. Symptoms fully resolved.',
                created_by=dr_mukwambo,
            ),

            # ── Kudzai Zvobgo (diabetic neuropathy) ───────────────────────────
            dict(
                patient=pts['Kudzai Zvobgo'], event_type='consultation',
                event_date=date(2024, 3, 12), hospital=masv, clinician=dr_musika,
                summary='Review following below-knee amputation (2022, diabetic foot). '
                        'Poorly controlled diabetes (HbA1c 11.2%). '
                        'Bilateral burning pain and paraesthesia in hands and feet. '
                        'Monofilament test: loss of protective sensation bilateral feet.',
                created_by=dr_musika,
            ),
            dict(
                patient=pts['Kudzai Zvobgo'], event_type='diagnosis',
                event_date=date(2024, 3, 12), hospital=masv, clinician=dr_musika,
                diagnosis='Diabetes mellitus type 2, poorly controlled. '
                          'Diabetic peripheral neuropathy (bilateral). '
                          'Status post right below-knee amputation.',
                summary='Creatinine 156 µmol/L (CKD Stage 3). '
                        'Eyes: non-proliferative diabetic retinopathy (referred ophthalmology). '
                        'BP 142/88. Weight 88kg.',
                created_by=dr_musika,
            ),
            dict(
                patient=pts['Kudzai Zvobgo'], event_type='medication',
                event_date=date(2024, 3, 15), hospital=masv, clinician=dr_musika,
                medications='Insulin glargine 20 units subcutaneous nocte (uptitrate by 2 units '
                            'every 3 days targeting FBG <7 mmol/L). '
                            'Pregabalin 75mg BD for neuropathic pain. '
                            'Amlodipine 5mg OD for hypertension. '
                            'Aspirin 75mg OD (secondary prevention). '
                            'Foot care education reinforced. Prosthesis review arranged.',
                summary='Podiatry referral made. Diabetic foot clinic enrolment confirmed.',
                created_by=dr_musika,
            ),
        ]

        for ev in events:
            patient = ev.pop('patient')
            # Only seed events if none exist yet for this patient (idempotent)
            if not patient.health_events.exists():
                HealthEvent.objects.create(patient=patient, **ev)
                self.stdout.write(f'  Event: [{ev["event_type"]}] -> {patient.full_name}')
            else:
                self.stdout.write(f'  Skip  : events already exist for {patient.full_name}')

    # ── Helpers ────────────────────────────────────────────────────────────────

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

    def _print_summary(self):
        self.stdout.write(self.style.SUCCESS('\nSeed complete -- all accounts use password: Passw0rd!\n'))
        rows = [
            ('admin@demo.test',              'System admin (no hospital)'),
            ('pari.admin@demo.test',         'Hospital admin — Parirenyatwa'),
            ('dr.muromo@demo.test',          'Doctor — Parirenyatwa'),
            ('dr.ncube.s@demo.test',         'Doctor — Parirenyatwa'),
            ('sr.makoni@demo.test',          'Nurse — Parirenyatwa'),
            ('harare.admin@demo.test',       'Hospital admin — Harare Central'),
            ('dr.mutasa@demo.test',          'Doctor — Harare Central'),
            ('mpilo.admin@demo.test',        'Hospital admin — Mpilo'),
            ('dr.mpofu@demo.test',           'Doctor — Mpilo'),
            ('dr.dube@demo.test',            'Doctor — Mpilo'),
            ('gweru.admin@demo.test',        'Hospital admin — Gweru'),
            ('dr.zimuto@demo.test',          'Doctor — Gweru'),
            ('chitu.admin@demo.test',        'Hospital admin — Chitungwiza'),
            ('dr.zhakata@demo.test',         'Doctor — Chitungwiza'),
            ('mutare.admin@demo.test',       'Hospital admin — Mutare'),
            ('dr.mukwambo@demo.test',        'Doctor — Mutare'),
            ('masv.admin@demo.test',         'Hospital admin — Masvingo'),
            ('dr.musikavanhu@demo.test',     'Doctor — Masvingo'),
        ]
        for email, desc in rows:
            self.stdout.write(f'  {email:<38} {desc}')
