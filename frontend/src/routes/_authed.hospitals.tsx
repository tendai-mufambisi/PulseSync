import { createRoute } from '@tanstack/react-router'
import { authedRoute } from './_authed'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import api from '../lib/api'
import type { Hospital, FacilityType } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useUnauthorizedLog } from '../hooks/useUnauthorizedLog'
import { SkeletonList, ErrorState, EmptyState, Spinner } from '../components/States'
import { Plus, X, Building2, Pencil, Check } from 'lucide-react'

export const hospitalsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/hospitals',
  component: HospitalsPage,
})

const FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'health_center', label: 'Health Center' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'other', label: 'Other' },
]

const EMPTY = { name: '', facility_type: 'hospital' as FacilityType, facility_type_other: '', location: '', phone: '' }

function HospitalsPage() {
  const { isSystemAdmin } = useAuth()
  useUnauthorizedLog(isSystemAdmin, '/hospitals')

  if (!isSystemAdmin) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        Hospital management is restricted to system administrators.
      </div>
    )
  }

  return <HospitalList />
}

function HospitalList() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [createError, setCreateError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY)
  const [editError, setEditError] = useState('')

  const { data, isLoading, isError } = useQuery<Hospital[]>({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const { data } = await api.get('/hospitals/')
      return data.results ?? data
    },
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof EMPTY) => api.post('/hospitals/', d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
      setShowCreate(false)
      setForm(EMPTY)
      setCreateError('')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: Record<string, string[]> } })?.response?.data
      setCreateError(d?.name?.[0] ?? d?.detail?.[0] ?? 'Failed to create hospital.')
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY }) =>
      api.patch(`/hospitals/${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
      setEditingId(null)
      setEditError('')
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: Record<string, string[]> } })?.response?.data
      setEditError(d?.name?.[0] ?? d?.detail?.[0] ?? 'Failed to update hospital.')
    },
  })

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const setEdit = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    setCreateError('')
    createMutation.mutate(form)
  }

  const startEdit = (h: Hospital) => {
    setEditingId(h.id)
    setEditForm({ name: h.name, facility_type: h.facility_type ?? 'hospital', facility_type_other: h.facility_type_other ?? '', location: h.location ?? '', phone: h.phone ?? '' })
    setEditError('')
  }

  const handleEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setEditError('')
    editMutation.mutate({ id: editingId, data: editForm })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Medical Centers</h1>
        <button
          onClick={() => { setShowCreate((v) => !v); setCreateError('') }}
          className="flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {showCreate ? <X size={15} /> : <Plus size={15} />}
          {showCreate ? 'Cancel' : 'Add Hospital'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            New Medical Center
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={set('name')}
                className="input"
                placeholder="Parirenyatwa Group of Hospitals"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Type *</label>
              <select
                value={form.facility_type}
                onChange={(e) => setForm((prev) => ({ ...prev, facility_type: e.target.value as FacilityType, facility_type_other: '' }))}
                className="input"
              >
                {FACILITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {form.facility_type === 'other' && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">Please specify *</label>
                <input
                  type="text"
                  required
                  value={form.facility_type_other}
                  onChange={set('facility_type_other')}
                  className="input"
                  placeholder="e.g. Dental Practice, Eye Clinic..."
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={set('location')}
                className="input"
                placeholder="Harare, Zimbabwe"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={set('phone')}
                className="input"
                placeholder="+263 4 794 411"
              />
            </div>
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
              Create Hospital
            </button>
          </div>
        </form>
      )}

      {isLoading && <div className="card p-4"><SkeletonList rows={3} /></div>}
      {isError && <ErrorState message="Could not load hospitals." />}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <EmptyState message="No hospitals registered yet. Add the first one." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((h) =>
          editingId === h.id ? (
            <form key={h.id} onSubmit={handleEdit} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Edit Hospital
                </span>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={setEdit('name')}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Type *</label>
                  <select
                    value={editForm.facility_type}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, facility_type: e.target.value as FacilityType, facility_type_other: '' }))}
                    className="input"
                  >
                    {FACILITY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {editForm.facility_type === 'other' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Please specify *</label>
                    <input
                      type="text"
                      required
                      value={editForm.facility_type_other}
                      onChange={setEdit('facility_type_other')}
                      className="input"
                      placeholder="e.g. Dental Practice, Eye Clinic..."
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={setEdit('location')}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={setEdit('phone')}
                    className="input"
                  />
                </div>
              </div>
              {editError && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                  {editError}
                </p>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {editMutation.isPending ? <Spinner size={13} /> : <Check size={13} />}
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div key={h.id} className="card p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                  <Building2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 truncate">{h.name}</p>
                  {h.location && (
                    <p className="text-xs text-slate-400 truncate">{h.location}</p>
                  )}
                </div>
                <button
                  onClick={() => startEdit(h)}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Edit hospital"
                >
                  <Pencil size={14} />
                </button>
              </div>
              <div className="mb-2">
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {h.facility_type === 'other' && h.facility_type_other
                    ? h.facility_type_other
                    : FACILITY_TYPES.find((t) => t.value === h.facility_type)?.label ?? 'Hospital'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                {h.phone ? <span>{h.phone}</span> : <span />}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                  {h.staff_count} staff
                </span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
