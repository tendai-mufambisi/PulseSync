import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { authedRoute } from './_authed'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { PatientListItem } from '../types'
import { Search } from 'lucide-react'
import { PageSpinner, ErrorState, EmptyState } from '../components/States'

export const searchRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/search',
  component: SearchPage,
})

function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  const { data, isLoading, isError } = useQuery<PatientListItem[]>({
    queryKey: ['patient-search', submitted],
    queryFn: async () => {
      if (!submitted) return []
      const { data } = await api.get('/patients/', {
        params: { national_id: submitted },
      })
      return data.results ?? data
    },
    enabled: !!submitted,
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) setSubmitted(trimmed)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Nationwide Patient Search</h1>

      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 63-2400679R42"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          <Search size={16} />
          Search
        </button>
      </form>

      {isLoading && <PageSpinner />}
      {isError && <ErrorState message="Search failed. Please try again." />}
      {!isLoading && !isError && submitted && data && data.length === 0 && (
        <EmptyState message={`No patient found with National ID "${submitted}".`} />
      )}

      {data && data.length > 0 && (
        <div className="card divide-y divide-slate-100">
          {data.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate({ to: '/patients/$patientId', params: { patientId: p.id } })}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{p.full_name}</p>
                <p className="text-xs text-slate-500">ID: {p.national_id} · DOB: {p.date_of_birth}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">
                {p.blood_type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
