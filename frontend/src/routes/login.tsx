import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type FormEvent } from 'react'
import { rootRoute } from './__root'
import { useAuth } from '../hooks/useAuth'
import { Activity } from 'lucide-react'
import { Spinner } from '../components/States'

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Navigate only after React has committed the user state update
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
      // Navigation is handled by the useEffect above — do not navigate here
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      const msg =
        e?.response?.data?.detail ??
        (e?.message === 'Network Error'
          ? 'Cannot reach the server. Make sure the backend is running.'
          : 'Invalid credentials. Please try again.')
      setError(msg)
    } finally {
      setLoading(false)
    }
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
      </div>
    </div>
  )
}
