import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authedRoute } from './_authed'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { PatientListItem } from '../types'
import { Search } from 'lucide-react'
import { SkeletonList, EmptyState, ErrorState } from '../components/States'

export const patientListRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/patients',
  component: PatientListPage,
})

function PatientListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery<PatientListItem[]>({
    queryKey: ['patients', search],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (search) params.search = search
      const { data } = await api.get('/patients/', { params })
      return data.results ?? data
    },
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Patients</h1>
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

        {isLoading && (
          <div className="px-4 py-2">
            <SkeletonList rows={6} />
          </div>
        )}
        {isError && <ErrorState message="Could not load patients." />}
        {!isLoading && !isError && data?.length === 0 && (
          <EmptyState message="No patients yet. Register the first one!" />
        )}
        {data?.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate({ to: '/patients/$patientId', params: { patientId: p.id } })}
            className="grid w-full grid-cols-4 gap-4 border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 last:border-0"
          >
            <span className="font-medium text-slate-900 truncate">{p.full_name}</span>
            <span className="text-slate-600 truncate">{p.national_id}</span>
            <span className="text-slate-500">{p.date_of_birth}</span>
            <span className="font-mono text-slate-600">{p.blood_type}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
