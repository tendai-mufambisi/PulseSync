import { AlertCircle, Inbox } from 'lucide-react'

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block animate-spin rounded-full border-2 border-slate-200 border-t-sky-600"
      aria-label="Loading"
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <Spinner size={32} />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex animate-pulse gap-4 py-3">
      <div className="h-4 w-1/4 rounded bg-slate-200" />
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-4 w-1/5 rounded bg-slate-200" />
    </div>
  )
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function EmptyState({ message = 'No records found.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <Inbox size={40} strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-red-500">
      <AlertCircle size={40} strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
    </div>
  )
}
