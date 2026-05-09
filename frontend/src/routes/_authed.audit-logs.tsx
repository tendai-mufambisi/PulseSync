import { createRoute } from '@tanstack/react-router'
import { authedRoute } from './_authed'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { AuditLog } from '../types'
import { useAuth } from '../hooks/useAuth'
import { SkeletonList, ErrorState, EmptyState } from '../components/States'

export const auditLogsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/audit-logs',
  component: AuditLogsPage,
})

function AuditLogsPage() {
  const { hasRole } = useAuth()

  if (!hasRole('admin')) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        Audit logs are restricted to admins.
      </div>
    )
  }

  return <AuditLogsList />
}

function AuditLogsList() {
  const { data, isLoading, isError } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await api.get('/audit-logs/')
      return data.results ?? data
    },
  })

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Audit Logs</h1>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Timestamp</span>
          <span>User</span>
          <span>Patient</span>
          <span>Action</span>
        </div>

        {isLoading && (
          <div className="px-4 py-2">
            <SkeletonList rows={8} />
          </div>
        )}
        {isError && <ErrorState message="Could not load audit logs." />}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState message="No audit events yet." />
        )}
        {data?.map((log) => (
          <div
            key={log.id}
            className="grid grid-cols-4 gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-0"
          >
            <span className="text-xs text-slate-500 font-mono">
              {new Date(log.timestamp).toLocaleString()}
            </span>
            <span className="truncate text-slate-700">{log.user_email ?? 'anonymous'}</span>
            <span className="truncate text-slate-600">{log.patient_name ?? '—'}</span>
            <span className="truncate text-slate-500">{log.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
