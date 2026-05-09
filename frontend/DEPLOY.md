# PulseSync Frontend — Vercel Deployment

## Prerequisites
- Vercel account (free tier works)
- Backend already deployed to PythonAnywhere

---

## Step-by-step

### Option A — Vercel CLI (recommended for first deploy)
```bash
cd pulsesync/frontend
npm install -g vercel
vercel login
vercel --prod
```
When prompted:
- **Root directory**: `frontend` (if deploying from the repo root), or `.` if already in `frontend/`
- **Build command**: `npm run build`
- **Output directory**: `dist`

### Option B — GitHub integration
1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Set **Root Directory** to `frontend`
4. Vercel auto-detects Vite — click **Deploy**

### Environment variable
In **Vercel → Project → Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR_USERNAME.pythonanywhere.com/api` |

Redeploy after adding the variable.

---

## Switching local ↔ production
Only the `.env` file changes:

| File | `VITE_API_URL` |
|---|---|
| `.env` (local) | `http://localhost:8000/api` |
| Vercel env var (prod) | `https://YOUR_USERNAME.pythonanywhere.com/api` |

Run locally with `npm run dev` — it reads `.env` automatically.  
On Vercel it reads the environment variable set in the dashboard.

No code changes needed.
