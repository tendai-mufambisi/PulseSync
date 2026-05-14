# PulseSync — Clinical EHR

A lightweight Electronic Health Records web app for clinics.  
**Backend**: Django 5 + DRF · **Frontend**: React 18 + Vite + TanStack Router

---

## Quick Start (local)

### Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # edit if needed
python manage.py migrate
python manage.py seed         # optional: loads demo users + 3 patients
python manage.py runserver
```
API is at **http://localhost:8000/api/**

### Frontend
```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000/api
npm run dev
```
App is at **http://localhost:5173/**

---

## Demo logins (after `python manage.py seed`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.test | Passw0rd! |
| Doctor | doctor@demo.test | Passw0rd! |
| Nurse | nurse@demo.test | Passw0rd! |

---

## Role matrix
| Action | admin | doctor | nurse |
|---|---|---|---|
| List / search patients | ✅ | ✅ | ✅ |
| Register patient | ✅ | ❌ | ✅ | |
| Edit patient | ✅ | ✅ | ✅ |
| Delete patient | ✅ | ❌ | ❌ |
| Add clinical record | ✅ | ✅ | ✅ |
| See `hiv_status` | ✅ | ✅ | ❌ redacted |
| View audit logs | ✅ | ❌ | ❌ |
| Manage user roles | ✅ | ❌ | ❌ |

---

## Environment variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | — | Django secret key |
| `DEBUG` | `True` | Set to `False` in production |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated hostnames |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `DATABASE_URL` | *(empty = SQLite)* | Full database URL for production |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/api` | Backend API base URL |

---

## Switching local ↔ production
Only `.env` files change — no code edits needed.

**Backend**: update `DEBUG`, `ALLOWED_HOSTS`, `FRONTEND_URL`, `DATABASE_URL`.  
**Frontend**: update `VITE_API_URL` (or set as a Vercel environment variable).

---

## Deployment
- **Backend → PythonAnywhere**: see `backend/DEPLOY.md`
- **Frontend → Vercel**: see `frontend/DEPLOY.md`

---

## Public emergency route (no auth)
```
GET /emergency/<patient-uuid>/
```
Returns blood type, allergies, critical conditions, emergency contact. Every access is logged with a null user in the audit log.

Frontend route: `/emergency/<patient-uuid>`
