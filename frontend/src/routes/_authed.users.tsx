import { createRoute } from '@tanstack/react-router'
import { authedRoute } from './_authed'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import api from '../lib/api'
import type { AuthUser, UserRole, Hospital } from '../types'
import { useAuth } from '../hooks/useAuth'
import { SkeletonList, ErrorState, EmptyState, Spinner } from '../components/States'
import { UserPlus, X } from 'lucide-react'

export const usersRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/users',
  component: UsersPage,
})

const ROLE_OPTIONS: UserRole[] = ['system_admin', 'hospital_admin', 'doctor', 'nurse']
const EMPTY_FORM = { email: '', full_name: '', password: '', role: 'nurse' as UserRole, hospital: '' }

function UsersPage() {
  const { hasRole, user: me } = useAuth()

  if (!hasRole('system_admin', 'hospital_admin')) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        User management is restricted to admins.
      </div>
    )
  }

  return <UsersList meId={me?.id ?? ''} />
}

function UsersList({ meId }: { meId: string }) {
  const { isSystemAdmin, isHospitalAdmin, user: me } = useAuth()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState('')

  const { data, isLoading, isError } = useQuery<AuthUser[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/auth/users/')
      return data.results ?? data
    },
  })

  const { data: hospitals } = useQuery<Hospital[]>({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const { data } = await api.get('/hospitals/')
      return data.results ?? data
    },
    enabled: isSystemAdmin,
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      api.patch(`/auth/users/${id}/role/`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => api.post('/auth/register/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setCreateError('')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data
      const raw = d?.detail ?? d?.email ?? d?.password ?? 'Failed to create user.'
      setCreateError(Array.isArray(raw) ? raw[0] : String(raw))
    },
  })

  const set = (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    setCreateError('')
    createMutation.mutate(form)
  }

  const availableRoles: UserRole[] = isSystemAdmin
    ? ROLE_OPTIONS
    : ['doctor', 'nurse']

  const roleLabel = (r: string) =>
    r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
          {isHospitalAdmin && me?.hospital_name && (
            <p className="mt-0.5 text-sm text-slate-500">{me.hospital_name}</p>
          )}
        </div>
        <button
          onClick={() => { setShowCreate((v) => !v); setCreateError('') }}
          className="flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {showCreate ? <X size={15} /> : <UserPlus size={15} />}
          {showCreate ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            New User Account
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={set('full_name')}
                className="input"
                placeholder="Dr. Jane Smith"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={set('email')}
                className="input"
                placeholder="jane@clinic.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Temporary Password *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={set('password')}
                className="input"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Role *</label>
              <select value={form.role} onChange={set('role')} className="input">
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>

            {isSystemAdmin && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Hospital / Clinic {form.role !== 'system_admin' && '*'}
                </label>
                <select
                  value={form.hospital}
                  onChange={set('hospital')}
                  required={form.role !== 'system_admin'}
                  className="input"
                >
                  <option value="">— Select hospital —</option>
                  {hospitals?.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {createError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {createError}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {createMutation.isPending && <Spinner size={15} />}
              Create Account
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-5 gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="col-span-2">User</span>
          <span>Hospital</span>
          <span>Role</span>
          <span>Change Role</span>
        </div>

        {isLoading && <div className="px-4 py-2"><SkeletonList rows={4} /></div>}
        {isError && <ErrorState message="Could not load users." />}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState message="No users found." />
        )}

        {data?.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-5 items-center gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-0"
          >
            <div className="col-span-2">
              <p className="font-medium text-slate-900">{u.full_name}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
            </div>
            <span className="truncate text-xs text-slate-500">
              {u.hospital_name ?? <span className="text-slate-300">—</span>}
            </span>
            <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
              {roleLabel(u.role)}
            </span>
            {u.id !== meId ? (
              <select
                value={u.role}
                onChange={(e) =>
                  roleMutation.mutate({ id: u.id, role: e.target.value as UserRole })
                }
                disabled={roleMutation.isPending}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-400">(you)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
