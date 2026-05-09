import { createRoute } from '@tanstack/react-router'
import { authedRoute } from './_authed'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import api from '../lib/api'
import type { Hospital } from '../types'
import { useAuth } from '../hooks/useAuth'
import { SkeletonList, ErrorState, EmptyState, Spinner } from '../components/States'
import { Plus, X, Building2 } from 'lucide-react'

export const hospitalsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/hospitals',
  component: HospitalsPage,
})

const EMPTY = { name: '', location: '', phone: '' }

function HospitalsPage() {
  const { isSystemAdmin } = useAuth()

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

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    setCreateError('')
    createMutation.mutate(form)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Hospitals & Clinics</h1>
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
            New Hospital / Clinic
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
        {data?.map((h) => (
          <div key={h.id} className="card p-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{h.name}</p>
                {h.location && (
                  <p className="text-xs text-slate-400 truncate">{h.location}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              {h.phone ? <span>{h.phone}</span> : <span />}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                {h.staff_count} staff
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
