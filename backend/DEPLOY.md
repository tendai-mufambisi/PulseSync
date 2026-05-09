# PulseSync Backend — PythonAnywhere Deployment

## Prerequisites
- A PythonAnywhere account (free tier works for SQLite; paid for MySQL)
- Your code in a git repo or uploaded as a ZIP

---

## Step-by-step

### 1. Upload the code
Open a PythonAnywhere Bash console and run:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git ~/pulsesync
# or upload a ZIP and unzip it
```

### 2. Create a virtual environment (Python 3.11)
```bash
mkvirtualenv --python=/usr/bin/python3.11 pulsesync
workon pulsesync
pip install -r ~/pulsesync/backend/requirements.txt
```

### 3. Create a `.env` file
```bash
cp ~/pulsesync/backend/.env.example ~/pulsesync/backend/.env
nano ~/pulsesync/backend/.env
```
Fill in:
```
SECRET_KEY=<generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DEBUG=False
ALLOWED_HOSTS=YOUR_USERNAME.pythonanywhere.com
FRONTEND_URL=https://YOUR_PROJECT.vercel.app
DATABASE_URL=          # leave empty for SQLite, or use mysql://user:pass@host/db
```

### 4. Configure the Web App
1. Go to **Web** tab → **Add a new web app**
2. Choose **Manual configuration** → **Python 3.11**
3. Set **Source code**: `/home/YOUR_USERNAME/pulsesync/backend`
4. Set **Virtualenv**: `/home/YOUR_USERNAME/.virtualenvs/pulsesync`

### 5. Edit the WSGI file
PythonAnywhere shows a link to the WSGI config file. Replace its contents with:
```python
import os
import sys

path = '/home/YOUR_USERNAME/pulsesync/backend'
if path not in sys.path:
    sys.path.insert(0, path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'pulsesync.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

### 6. Run migrations and collect static
In the Bash console (with venv active):
```bash
cd ~/pulsesync/backend
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seed          # optional: load demo data
```

### 7. Reload
Click **Reload** on the Web tab. Your API will be at:
`https://YOUR_USERNAME.pythonanywhere.com/api/`

---

## Switching local ↔ production
Only the `.env` file changes between environments:

| Variable | Local | Production |
|---|---|---|
| `DEBUG` | `True` | `False` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | `YOUR_USERNAME.pythonanywhere.com` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://YOUR_PROJECT.vercel.app` |
| `DATABASE_URL` | *(empty = SQLite)* | mysql://... or sqlite path |

No code changes needed — just swap `.env` values.
