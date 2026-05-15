import { createRoute } from '@tanstack/react-router'
import { authedRoute } from './_authed'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../lib/api'
import type { AuditLog, Hospital } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useUnauthorizedLog } from '../hooks/useUnauthorizedLog'
import { SkeletonList, ErrorState, EmptyState } from '../components/States'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const auditLogsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/audit-logs',
  component: AuditLogsPage,
})

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-red-100 text-red-700',
  critical: 'bg-red-200 text-red-900',
}

const SEVERITY_ROW_BG: Record<string, string> = {
  warning: 'bg-red-50 border-l-4 border-l-red-400',
  critical: 'bg-red-100 border-l-4 border-l-red-600',
}

const CATEGORIES = ['auth', 'patient', 'record', 'staff', 'emergency', 'system']
const SEVERITIES = ['info', 'warning', 'critical']

interface PagedResult {
  count: number
  next: string | null
  previous: string | null
  results: AuditLog[]
}

function AuditLogsPage() {
  const { hasRole } = useAuth()
  const isAllowed = hasRole('system_admin', 'hospital_admin')
  useUnauthorizedLog(isAllowed, '/audit-logs')

  if (!isAllowed) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        Audit logs are restricted to administrators.
      </div>
    )
  }

  return <AuditLogsList />
}

function AuditLogsList() {
  const { isSystemAdmin } = useAuth()
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [hospital, setHospital] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { data: hospitals } = useQuery<Hospital[]>({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const { data } = await api.get('/hospitals/')
      return data.results ?? data
    },
    enabled: isSystemAdmin,
  })

  const params = new URLSearchParams({ page: String(page) })
  if (severity) params.set('severity', severity)
  if (category) params.set('category', category)
  if (hospital && isSystemAdmin) params.set('hospital', hospital)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)

  const { data, isLoading, isError } = useQuery<PagedResult>({
    queryKey: ['audit-logs', severity, category, hospital, dateFrom, dateTo, page],
    queryFn: async () => {
      const { data } = await api.get(`/audit-logs/?${params.toString()}`)
      if (Array.isArray(data)) return { count: data.length, next: null, previous: null, results: data }
      return data
    },
  })

  const resetFilters = () => {
    setSeverity('')
    setCategory('')
    setHospital('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const logs = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / 50) : 0

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Audit Logs</h1>
        {data && (
          <p className="text-sm text-slate-400">{data.count.toLocaleString()} total entries</p>
        )}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1) }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500">
          <option value="">All Severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        {isSystemAdmin && (
          <select value={hospital} onChange={(e) => { setHospital(e.target.value); setPage(1) }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500">
            <option value="">All Hospitals</option>
            {hospitals?.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
          placeholder="To"
        />

        {(severity || category || hospital || dateFrom || dateTo) && (
          <button onClick={resetFilters}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
            Clear
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span className="col-span-2">Timestamp</span>
          <span className="col-span-2">User</span>
          <span className="col-span-1">Role</span>
          <span className="col-span-2">Hospital</span>
          <span className="col-span-3">Action</span>
          <span className="col-span-1">Category</span>
          <span className="col-span-1">Severity</span>
        </div>

        {isLoading && (
          <div className="px-4 py-2"><SkeletonList rows={8} /></div>
        )}
        {isError && <ErrorState message="Could not load audit logs." />}
        {!isLoading && !isError && logs.length === 0 && (
          <EmptyState message="No audit events match your filters." />
        )}
        {logs.map((log) => (
          <div
            key={log.id}
            className={`grid grid-cols-12 items-start gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-0 ${SEVERITY_ROW_BG[log.severity] ?? ''}`}
          >
            <span className="col-span-2 text-xs font-mono text-slate-500">
              {new Date(log.timestamp).toLocaleString()}
            </span>
            <div className="col-span-2">
              <p className="truncate text-slate-700 text-xs">{log.user_email ?? 'anonymous'}</p>
            </div>
            <span className="col-span-1 truncate text-xs text-slate-500 capitalize">
              {log.user_role?.replace(/_/g, ' ') ?? '—'}
            </span>
            <span className="col-span-2 truncate text-xs text-slate-500">
              {log.hospital_name ?? '—'}
            </span>
            <span className="col-span-3 text-xs text-slate-600 break-words">{log.action}</span>
            <span className="col-span-1">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 capitalize">
                {log.category}
              </span>
            </span>
            <span className="col-span-1">
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold capitalize ${SEVERITY_COLORS[log.severity] ?? 'bg-slate-100 text-slate-600'}`}>
                {log.severity}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
