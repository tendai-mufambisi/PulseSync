# PulseSync — National Clinical EHR

A longitudinal Electronic Health Records platform built for national healthcare infrastructure.  
Patients have a **lifelong health timeline** — from birth through every consultation, diagnosis, medication, and emergency — across any facility in the network.

**Backend**: Django 5 + Django REST Framework · **Frontend**: React 18 + Vite + TanStack Router  
**Offline-first PWA** — registers patients, serves records, and syncs automatically when connectivity returns.

---

## Features

- **Two registration paths** — Newborn (with birth event, guardian info) and Existing Individual (with medical history baseline)
- **Longitudinal health timeline** — six structured event types: Birth, Consultation, Diagnosis, Medication, Emergency, Sensitive
- **Sensitive data access control** — nurses see redacted HIV status; sensitive events hidden by role
- **Offline-first PWA** — cached login, offline patient registration (auto-syncs on reconnect), facility patient pre-cache after login
- **Staff management** — discharge (remove from facility with reason) instead of deletion; accounts stay active and reassignable
- **Audit logging** — every action logged with user, category, and severity
- **Paramedic role** — emergency-only patient access via public `/emergency/<id>/` route
- **Install prompt** — appears in sidebar; works as a native app on mobile and desktop

---

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit SECRET_KEY at minimum
python manage.py migrate
python manage.py seed           # optional demo data
python manage.py runserver
```
API at **http://localhost:8000/api/**

### Frontend
```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_URL=http://localhost:8000/api
npm run dev
```
App at **http://localhost:5173/**

---

## Demo logins (after `python manage.py seed`)

| Role | Email | Password |
|---|---|---|
| System Admin | admin@demo.test | Passw0rd! |
| Doctor | doctor@demo.test | Passw0rd! |
| Nurse | nurse@demo.test | Passw0rd! |
| Paramedic | paramedic@demo.test | Passw0rd! |

---

## Role matrix

| Action | system_admin | hospital_admin | doctor | nurse | paramedic |
|---|---|---|---|---|---|
| Register patient (newborn / existing) | ✅ | ✅ | ✅ | ✅ | ❌ |
| View patient list & details | ✅ | ✅ | ✅ | ✅ | emergency only |
| View health timeline | ✅ | ✅ | ✅ | ✅ (no sensitive) | ❌ |
| Add health events | ✅ | ✅ | ✅ | ✅ | ❌ |
| See HIV status | ✅ | ✅ | ✅ | ❌ redacted | ❌ |
| Edit patient demographics | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete patient | ✅ | ❌ | ❌ | ❌ | ❌ |
| Discharge staff from facility | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage users / create accounts | ✅ | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage hospitals | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Offline capability

PulseSync is a Progressive Web App with full offline support:

| Scenario | Behaviour |
|---|---|
| App visited at least once | App shell cached — loads instantly offline |
| Signed in at least once | "Continue offline" option on login page — no password re-entry needed |
| After first login | All facility patients pre-cached in background (list + top 100 detail pages) |
| Register patient while offline | Saved locally — auto-synced the moment connectivity returns |
| Read patient records offline | Available if previously loaded; served from service worker cache |
| Write clinical data offline | Not queued — clinical writes require a live server connection |

To test offline: `npm run build && npm run preview`, then DevTools → Application → Service Workers → tick Offline.

---

## Environment variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | — | Django secret key — **change in production** |
| `DEBUG` | `True` | Set `False` in production |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated hostnames |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `DATABASE_URL` | *(empty = SQLite)* | Full `postgres://` URL for production |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/api` | Backend API base URL |

---

## Deployment
- **Backend → PythonAnywhere / Railway**: see `backend/DEPLOY.md`
- **Frontend → Vercel**: see `frontend/DEPLOY.md`

---

## Public emergency route (no auth required)

```
GET /emergency/<patient-uuid>/
```
Returns blood type, allergies, critical conditions, and emergency contacts only.  
Every access is logged with a null user in the audit trail.

Frontend: `/emergency/<patient-uuid>`
