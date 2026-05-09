import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type FormEvent } from 'react'
import { rootRoute } from './__root'
import { useAuth } from '../hooks/useAuth'
import { Activity, KeyRound } from 'lucide-react'
import { Spinner } from '../components/States'
import api from '../lib/api'

export const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/change-password',
  component: ChangePasswordPage,
})

function ChangePasswordPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate({ to: '/login', replace: true })
    } else if (!user.must_change_password) {
      // Password was just changed — React has committed the update, safe to navigate
      navigate({ to: '/dashboard', replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      await refreshUser()
      // Navigation is handled by the useEffect above — do not navigate here
    } catch (err: unknown) {
      const d = (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data
      const msg = d?.old_password ?? d?.new_password ?? d?.detail ?? 'Failed to change password.'
      setError(Array.isArray(msg) ? msg[0] : msg)
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
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Set your password</h2>
              <p className="text-xs text-slate-500">
                You must change your temporary password before continuing.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Temporary password
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Enter your temporary password"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Repeat new password"
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
              Set new password
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
