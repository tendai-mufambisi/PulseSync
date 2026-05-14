import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type FormEvent } from 'react'
import { rootRoute } from './__root'
import { useAuth } from '../hooks/useAuth'
import { getLastUser } from '../lib/auth'
import { Activity, WifiOff } from 'lucide-react'
import { Spinner } from '../components/States'
import type { AuthUser } from '../types'

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

function roleLabel(role: string) {
  if (role === 'system_admin') return 'System Admin'
  if (role === 'hospital_admin') return 'Hospital Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function LoginPage() {
  const { user, signIn, signInOffline } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastUser] = useState<AuthUser | null>(() => getLastUser())

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Navigate after user state is set
  useEffect(() => {
    if (!user) return
    navigate({ to: user.must_change_password ? '/change-password' : '/dashboard', replace: true })
  }, [user, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      const msg =
        e?.response?.data?.detail ??
        (e?.message === 'Network Error'
          ? 'Cannot reach the server. Make sure you are connected to the internet.'
          : 'Invalid credentials. Please try again.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleOfflineSignIn = () => {
    const ok = signInOffline()
    if (!ok) setError('No offline session found. Please connect to the internet to sign in.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-sky-600">
            <Activity size={32} />
            <span className="text-2xl font-bold tracking-tight text-slate-900">PulseSync</span>
          </div>
          <p className="text-sm text-slate-500">Clinical Electronic Health Records</p>
        </div>

        {/* ── Offline banner ── */}
        {!isOnline && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <WifiOff size={15} className="shrink-0" />
            <span>You are offline.</span>
          </div>
        )}

        {/* ── Offline: cached session available ── */}
        {!isOnline && lastUser ? (
          <div className="card p-6">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Continue offline as
            </p>
            <div className="mb-5 mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                {lastUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{lastUser.full_name}</p>
                <p className="text-xs text-slate-400">
                  {roleLabel(lastUser.role)}
                  {lastUser.hospital_name ? ` · ${lastUser.hospital_name}` : ''}
                </p>
              </div>
            </div>
            {error && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <button
              onClick={handleOfflineSignIn}
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Continue offline
            </button>
            <p className="mt-4 text-center text-xs text-slate-400">
              To sign in as a different user, connect to the internet first.
            </p>
          </div>
        ) : !isOnline && !lastUser ? (
          /* ── Offline: no cached session ── */
          <div className="card p-6 text-center">
            <WifiOff size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No offline session available</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              You need to sign in at least once while connected to the internet. PulseSync will
              then remember your session for future offline use on this device.
            </p>
          </div>
        ) : (
          /* ── Online: normal login form ── */
          <div className="card p-6">
            <h2 className="mb-5 text-sm font-semibold text-slate-700">Sign in to your account</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="you@clinic.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                {loading && <Spinner size={16} />}
                Sign in
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-400">
              Accounts are created by your system administrator.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
