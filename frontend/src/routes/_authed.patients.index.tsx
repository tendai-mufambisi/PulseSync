import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { authedRoute } from './_authed'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { getPending } from '../lib/offlineQueue'
import type { PatientListItem, RegistrationType } from '../types'
import { Search, Clock } from 'lucide-react'
import { SkeletonList, EmptyState, ErrorState } from '../components/States'

export const patientListRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/patients',
  component: PatientListPage,
})

function pendingToListItem(p: ReturnType<typeof getPending>[number]): PatientListItem {
  return {
    id: p.id,
    full_name: p.label,
    national_id: (p.payload.national_id as string | undefined) ?? null,
    date_of_birth: (p.payload.date_of_birth as string | undefined) ?? '—',
    gender: (p.payload.gender as string | undefined) ?? '',
    blood_type: (p.payload.blood_type as string | undefined) ?? 'unknown',
    registration_type: p.registrationType as RegistrationType,
    created_at: p.queuedAt,
    _pending: true,
  }
}

function PatientListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [pendingPatients, setPendingPatients] = useState<PatientListItem[]>(() =>
    getPending().map(pendingToListItem),
  )

  // Refresh pending list whenever a patient is enqueued or a sync completes
  useEffect(() => {
    const refresh = () => setPendingPatients(getPending().map(pendingToListItem))
    window.addEventListener('pwa:patient-enqueued', refresh)
    window.addEventListener('pwa:sync-complete', refresh)
    return () => {
      window.removeEventListener('pwa:patient-enqueued', refresh)
      window.removeEventListener('pwa:sync-complete', refresh)
    }
  }, [])

  const { data: serverPatients, isLoading, isError } = useQuery<PatientListItem[]>({
    queryKey: ['patients', search],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (search) params.search = search
      const { data } = await api.get('/patients/', { params })
      return data.results ?? data
    },
  })

  // Merge: pending patients on top, then server patients (exclude any that share
  // a name with a pending one — avoids a duplicate flash right after sync)
  const pendingIds = new Set(pendingPatients.map((p) => p.id))
  const filteredServer = (serverPatients ?? []).filter(
    (p) => !pendingIds.has(p.id),
  )

  // Apply client-side search filter to pending patients too
  const visiblePending = search
    ? pendingPatients.filter((p) =>
        p.full_name.toLowerCase().includes(search.toLowerCase()),
      )
    : pendingPatients

  const allPatients = [...visiblePending, ...filteredServer]
  const hasAnything = allPatients.length > 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">All Patients — Zimbabwe</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Name</span>
          <span>National ID</span>
          <span>DOB</span>
          <span>Blood Type</span>
        </div>

        {isLoading && !hasAnything && (
          <div className="px-4 py-2">
            <SkeletonList rows={6} />
          </div>
        )}

        {/* Only show the error state when we have absolutely nothing to display */}
        {isError && !hasAnything && (
          <ErrorState
            message={
              navigator.onLine
                ? 'Could not load patients.'
                : 'No patient records cached yet. Connect to the internet to load patients.'
            }
          />
        )}

        {!isLoading && !isError && !hasAnything && (
          <EmptyState message="No patients yet. Register the first one!" />
        )}

        {allPatients.map((p) =>
          p._pending ? (
            <div
              key={p.id}
              className="grid w-full grid-cols-4 gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-0 opacity-70"
              title="Saved offline — will sync automatically when connected"
            >
              <span className="flex items-center gap-2 font-medium text-slate-700 truncate">
                {p.full_name}
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Clock size={10} />
                  Pending
                </span>
              </span>
              <span className="text-slate-400 truncate">{p.national_id ?? '—'}</span>
              <span className="text-slate-400">{p.date_of_birth}</span>
              <span className="font-mono text-slate-400">{p.blood_type}</span>
            </div>
          ) : (
            <button
              key={p.id}
              onClick={() => navigate({ to: '/patients/$patientId', params: { patientId: p.id } })}
              className="grid w-full grid-cols-4 gap-4 border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 last:border-0"
            >
              <span className="font-medium text-slate-900 truncate">{p.full_name}</span>
              <span className="text-slate-600 truncate">{p.national_id ?? '—'}</span>
              <span className="text-slate-500">{p.date_of_birth}</span>
              <span className="font-mono text-slate-600">{p.blood_type}</span>
            </button>
          ),
        )}
      </div>
    </div>
  )
}
