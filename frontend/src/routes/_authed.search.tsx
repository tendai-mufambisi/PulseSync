import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { authedRoute } from './_authed'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { PatientListItem } from '../types'
import { Search, Loader2, UserRound } from 'lucide-react'

export const searchRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/search',
  component: SearchPage,
})

function SearchPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce: fire query 300 ms after the user stops typing
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(input.trim())
    }, 300)
    return () => clearTimeout(id)
  }, [input])

  // Show dropdown whenever there's a query
  useEffect(() => {
    setOpen(debouncedQ.length >= 2)
  }, [debouncedQ])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data, isFetching } = useQuery<PatientListItem[]>({
    queryKey: ['patient-search-live', debouncedQ],
    queryFn: async () => {
      if (debouncedQ.length < 2) return []
      const { data } = await api.get('/patients/', { params: { q: debouncedQ } })
      return data.results ?? data
    },
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  })

  const pick = (p: PatientListItem) => {
    setOpen(false)
    navigate({ to: '/patients/$patientId', params: { patientId: p.id } })
  }

  const suggestions = data ?? []

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Nationwide Patient Search</h1>
      <p className="mb-6 text-sm text-slate-500">
        Search by name or national ID — with or without the dash (e.g.{' '}
        <code className="rounded bg-slate-100 px-1 font-mono text-xs">63-2400679R42</code>{' '}
        or{' '}
        <code className="rounded bg-slate-100 px-1 font-mono text-xs">632400679R42</code>)
      </p>

      {/* Search box + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => { if (debouncedQ.length >= 2) setOpen(true) }}
            placeholder="Name or national ID (e.g. 63-2400679R42 or 632400679R42)…"
            className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-10 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            autoComplete="off"
          />
          {isFetching && (
            <Loader2
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
            />
          )}
        </div>

        {/* Suggestions dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggestions.length === 0 && !isFetching && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No patients found for &ldquo;{debouncedQ}&rdquo;
              </div>
            )}
            {isFetching && suggestions.length === 0 && (
              <div className="px-4 py-5 text-center text-sm text-slate-400">Searching…</div>
            )}
            {suggestions.map((p) => (
              <button
                key={p.id}
                onMouseDown={(e) => {
                  // Use mousedown so it fires before the blur/outside-click handler
                  e.preventDefault()
                  pick(p)
                }}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-sky-50 last:border-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <UserRound size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{p.full_name}</p>
                  <p className="text-xs text-slate-500">
                    ID: {p.national_id} &middot; DOB: {p.date_of_birth}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                  {p.blood_type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Persistent results list (shown after user has searched) */}
      {!open && suggestions.length > 0 && debouncedQ.length >= 2 && (
        <div className="mt-4 card divide-y divide-slate-100 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            {suggestions.length} result{suggestions.length !== 1 ? 's' : ''} for &ldquo;{debouncedQ}&rdquo;
          </div>
          {suggestions.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <UserRound size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{p.full_name}</p>
                <p className="text-xs text-slate-500">
                  ID: {p.national_id} &middot; DOB: {p.date_of_birth}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                {p.blood_type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
