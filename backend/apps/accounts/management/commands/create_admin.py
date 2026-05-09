from django.core.management.base import BaseCommand
from apps.accounts.models import User, Role


class Command(BaseCommand):
    help = 'Create the initial system admin account'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--password', required=True)
        parser.add_argument('--name', required=True, dest='full_name')

    def handle(self, *args, **options):
        email = options['email']
        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f'Admin {email} already exists.'))
            return
        User.objects.create_user(
            email=email,
            password=options['password'],
            full_name=options['full_name'],
            role=Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.stdout.write(self.style.SUCCESS(f'Admin created: {email}'))
