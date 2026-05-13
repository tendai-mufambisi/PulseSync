import { createRoute } from '@tanstack/react-router'
import { authedRoute } from './_authed'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import api from '../lib/api'
import type { AuthUser, UserRole, Hospital } from '../types'
import { useAuth } from '../hooks/useAuth'
import { SkeletonList, ErrorState, EmptyState, Spinner } from '../components/States'
import {
  UserPlus, X, Pencil, Trash2, ArrowRightLeft, ShieldPlus,
} from 'lucide-react'

export const staffRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/staff',
  component: StaffPage,
})

type StaffForm = {
  email: string
  full_name: string
  password: string
  role: UserRole
  hospital: string
}

const EMPTY_FORM: StaffForm = {
  email: '',
  full_name: '',
  password: '',
  role: 'nurse',
  hospital: '',
}

const SYSADMIN_FORM = { email: '', full_name: '', password: '' }

function roleLabel(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function StaffPage() {
  const { hasRole } = useAuth()

  if (!hasRole('system_admin', 'hospital_admin')) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        Staff management is restricted to administrators.
      </div>
    )
  }

  return <StaffList />
}

function StaffList() {
  const { isSystemAdmin, isHospitalAdmin, user: me } = useAuth()
  const queryClient = useQueryClient()

  const [showAddStaff, setShowAddStaff] = useState(false)
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
  const [transferUser, setTransferUser] = useState<AuthUser | null>(null)
  const [transferHospitalId, setTransferHospitalId] = useState('')

  const [staffForm, setStaffForm] = useState<StaffForm>(EMPTY_FORM)
  const [adminForm, setAdminForm] = useState(SYSADMIN_FORM)
  const [editForm, setEditForm] = useState<Partial<StaffForm>>({})

  const [filterHospital, setFilterHospital] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [staffError, setStaffError] = useState('')
  const [adminError, setAdminError] = useState('')
  const [editError, setEditError] = useState('')

  const queryParams = new URLSearchParams()
  if (filterHospital) queryParams.set('hospital', filterHospital)
  if (filterRole) queryParams.set('role', filterRole)

  const { data: staff, isLoading, isError } = useQuery<AuthUser[]>({
    queryKey: ['staff', filterHospital, filterRole],
    queryFn: async () => {
      const { data } = await api.get(`/auth/staff/?${queryParams.toString()}`)
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

  const createStaffMutation = useMutation({
    mutationFn: (data: StaffForm) => api.post('/auth/staff/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowAddStaff(false)
      setStaffForm(EMPTY_FORM)
      setStaffError('')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data
      const raw = d?.detail ?? d?.email ?? d?.hospital ?? 'Failed to create staff member.'
      setStaffError(Array.isArray(raw) ? raw[0] : String(raw))
    },
  })

  const createAdminMutation = useMutation({
    mutationFn: (data: typeof SYSADMIN_FORM) => api.post('/auth/admins/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowAddAdmin(false)
      setAdminForm(SYSADMIN_FORM)
      setAdminError('')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data
      const raw = d?.detail ?? d?.email ?? 'Failed to create system admin.'
      setAdminError(Array.isArray(raw) ? raw[0] : String(raw))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffForm> }) =>
      api.patch(`/auth/staff/${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setEditingUser(null)
      setEditError('')
    },
    onError: () => setEditError('Failed to update staff member.'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/staff/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })

  const transferMutation = useMutation({
    mutationFn: ({ id, hospitalId }: { id: string; hospitalId: string }) =>
      api.post(`/auth/staff/${id}/transfer/`, { hospital_id: hospitalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setTransferUser(null)
      setTransferHospitalId('')
    },
  })

  const set = (field: keyof StaffForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setStaffForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setAdmin = (field: keyof typeof SYSADMIN_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setAdminForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setEdit = (field: keyof StaffForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEditForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleAddStaff = (e: FormEvent) => {
    e.preventDefault()
    setStaffError('')
    createStaffMutation.mutate(staffForm)
  }

  const handleAddAdmin = (e: FormEvent) => {
    e.preventDefault()
    setAdminError('')
    createAdminMutation.mutate(adminForm)
  }

  const handleEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setEditError('')
    updateMutation.mutate({ id: editingUser.id, data: editForm })
  }

  const handleTransfer = (e: FormEvent) => {
    e.preventDefault()
    if (!transferUser || !transferHospitalId) return
    transferMutation.mutate({ id: transferUser.id, hospitalId: transferHospitalId })
  }

  const startEdit = (u: AuthUser) => {
    setEditingUser(u)
    setEditForm({
      full_name: u.full_name,
      role: u.role,
      hospital: u.hospital ?? '',
    })
    setEditError('')
  }

  const availableRoles: UserRole[] = isSystemAdmin
    ? ['system_admin', 'hospital_admin', 'doctor', 'nurse']
    : ['doctor', 'nurse']

  // Group staff by hospital for system admin view
  const grouped = isSystemAdmin && staff
    ? staff.reduce<Record<string, AuthUser[]>>((acc, u) => {
        const key = u.hospital_name ?? 'System Level (No Hospital)'
        if (!acc[key]) acc[key] = []
        acc[key].push(u)
        return acc
      }, {})
    : null

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Staff Management</h1>
          {isHospitalAdmin && me?.hospital_name && (
            <p className="mt-0.5 text-sm text-slate-500">{me.hospital_name}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShowAddStaff((v) => !v); setStaffError('') }}
            className="flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            {showAddStaff ? <X size={15} /> : <UserPlus size={15} />}
            {showAddStaff ? 'Cancel' : 'Add Staff'}
          </button>
          {isSystemAdmin && (
            <button
              onClick={() => { setShowAddAdmin((v) => !v); setAdminError('') }}
              className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              {showAddAdmin ? <X size={15} /> : <ShieldPlus size={15} />}
              {showAddAdmin ? 'Cancel' : 'Add System Admin'}
            </button>
          )}
        </div>
      </div>

      {/* Add Staff Form */}
      {showAddStaff && (
        <form onSubmit={handleAddStaff} className="card mb-6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            New Staff Member
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Full Name *</label>
              <input type="text" required value={staffForm.full_name} onChange={set('full_name')}
                className="input" placeholder="Dr. Jane Smith" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email *</label>
              <input type="email" required value={staffForm.email} onChange={set('email')}
                className="input" placeholder="jane@clinic.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Temporary Password *</label>
              <input type="password" required minLength={8} value={staffForm.password}
                onChange={set('password')} className="input" placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Role *</label>
              <select value={staffForm.role} onChange={set('role')} className="input">
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>
            {isSystemAdmin && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Hospital *
                </label>
                <select value={staffForm.hospital} onChange={set('hospital')}
                  required={staffForm.role !== 'system_admin'} className="input">
                  <option value="">— Select hospital —</option>
                  {hospitals?.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {staffError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{staffError}</p>
          )}
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={createStaffMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
              {createStaffMutation.isPending && <Spinner size={15} />}
              Create Staff Member
            </button>
          </div>
        </form>
      )}

      {/* Add System Admin Form */}
      {showAddAdmin && isSystemAdmin && (
        <form onSubmit={handleAddAdmin} className="card mb-6 border border-amber-200 p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-600">
            Create System Admin
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            System admins have full platform access. Use with caution.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Full Name *</label>
              <input type="text" required value={adminForm.full_name} onChange={setAdmin('full_name')}
                className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Email *</label>
              <input type="email" required value={adminForm.email} onChange={setAdmin('email')}
                className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Password *</label>
              <input type="password" required minLength={8} value={adminForm.password}
                onChange={setAdmin('password')} className="input" />
            </div>
          </div>
          {adminError && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{adminError}</p>
          )}
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={createAdminMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60">
              {createAdminMutation.isPending && <Spinner size={15} />}
              Create System Admin
            </button>
          </div>
        </form>
      )}

      {/* Edit Staff Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleEdit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Edit Staff Member</h2>
              <button type="button" onClick={() => setEditingUser(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Full Name</label>
                <input type="text" value={editForm.full_name ?? ''} onChange={setEdit('full_name')}
                  className="input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Role</label>
                <select value={editForm.role ?? 'nurse'} onChange={setEdit('role')} className="input">
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </div>
              {isSystemAdmin && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Hospital</label>
                  <select value={editForm.hospital ?? ''} onChange={setEdit('hospital')} className="input">
                    <option value="">— None (system admin) —</option>
                    {hospitals?.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {editError && <p className="mt-2 text-sm text-red-600">{editError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingUser(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={updateMutation.isPending}
                className="flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60">
                {updateMutation.isPending && <Spinner size={14} />}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal */}
      {transferUser && isSystemAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleTransfer} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                Transfer {transferUser.full_name}
              </h2>
              <button type="button" onClick={() => setTransferUser(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Transfer to Hospital *
              </label>
              <select required value={transferHospitalId}
                onChange={(e) => setTransferHospitalId(e.target.value)} className="input">
                <option value="">— Select hospital —</option>
                {hospitals?.filter((h) => h.id !== transferUser.hospital)?.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTransferUser(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={transferMutation.isPending}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {transferMutation.isPending && <Spinner size={14} />}
                Transfer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        {isSystemAdmin && (
          <select value={filterHospital} onChange={(e) => setFilterHospital(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500">
            <option value="">All Hospitals</option>
            {hospitals?.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        )}
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500">
          <option value="">All Roles</option>
          {(['system_admin', 'hospital_admin', 'doctor', 'nurse'] as UserRole[]).map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="card p-4"><SkeletonList rows={6} /></div>}
      {isError && <ErrorState message="Could not load staff." />}
      {!isLoading && !isError && (!staff || staff.length === 0) && (
        <EmptyState message="No staff found." />
      )}

      {/* System admin: grouped by hospital */}
      {isSystemAdmin && grouped && !isLoading && (
        <div className="space-y-5">
          {Object.entries(grouped).map(([hospitalName, members]) => (
            <div key={hospitalName} className="card overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {hospitalName}
                </h3>
              </div>
              <StaffTable
                staff={members}
                meId={me?.id ?? ''}
                isSystemAdmin={isSystemAdmin}
                onEdit={startEdit}
                onDeactivate={(u) => {
                  if (confirm(`Deactivate ${u.full_name}? They will lose system access.`)) {
                    deactivateMutation.mutate(u.id)
                  }
                }}
                onTransfer={setTransferUser}
              />
            </div>
          ))}
        </div>
      )}

      {/* Hospital admin: flat list */}
      {isHospitalAdmin && !isLoading && staff && staff.length > 0 && (
        <div className="card overflow-hidden">
          <StaffTable
            staff={staff}
            meId={me?.id ?? ''}
            isSystemAdmin={false}
            onEdit={startEdit}
            onDeactivate={(u) => {
              if (confirm(`Deactivate ${u.full_name}? They will lose system access.`)) {
                deactivateMutation.mutate(u.id)
              }
            }}
            onTransfer={() => {}}
          />
        </div>
      )}
    </div>
  )
}

function StaffTable({
  staff, meId, isSystemAdmin, onEdit, onDeactivate, onTransfer,
}: {
  staff: AuthUser[]
  meId: string
  isSystemAdmin: boolean
  onEdit: (u: AuthUser) => void
  onDeactivate: (u: AuthUser) => void
  onTransfer: (u: AuthUser) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span className="col-span-3">Name</span>
        <span className="col-span-3">Email</span>
        <span className="col-span-2">Role</span>
        <span className="col-span-2">Status</span>
        <span className="col-span-2">Actions</span>
      </div>
      {staff.map((u) => (
        <div
          key={u.id}
          className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-0"
        >
          <div className="col-span-3">
            <p className="font-medium text-slate-900">{u.full_name}</p>
          </div>
          <span className="col-span-3 truncate text-xs text-slate-500">{u.email}</span>
          <span className="col-span-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
              {u.role.replace(/_/g, ' ')}
            </span>
          </span>
          <span className="col-span-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {u.is_active ? 'Active' : 'Inactive'}
            </span>
          </span>
          <div className="col-span-2 flex items-center gap-1">
            {u.id !== meId && (
              <>
                <button onClick={() => onEdit(u)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Edit">
                  <Pencil size={13} />
                </button>
                {isSystemAdmin && (
                  <button onClick={() => onTransfer(u)}
                    className="rounded-md p-1.5 text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
                    title="Transfer to another hospital">
                    <ArrowRightLeft size={13} />
                  </button>
                )}
                {u.is_active && (
                  <button onClick={() => onDeactivate(u)}
                    className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                    title="Deactivate">
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )}
            {u.id === meId && (
              <span className="text-xs text-slate-400">(you)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
