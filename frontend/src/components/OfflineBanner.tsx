import { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw, Download, UploadCloud, CheckCircle, AlertTriangle, DatabaseZap } from 'lucide-react'
import { pendingCount } from '../lib/offlineQueue'
import { useAuth } from '../hooks/useAuth'

type BannerState =
  | 'hidden'
  | 'offline'
  | 'back-online'
  | 'update-available'
  | 'offline-ready'
  | 'facility-cached'
  | 'syncing'
  | 'sync-complete'
  | 'sync-failed'

interface SyncResult {
  synced: number
  failed: string[]
}

export function OfflineBanner() {
  const { user } = useAuth()
  const [state, setState] = useState<BannerState>('hidden')
  const [offlineSince, setOfflineSince] = useState<Date | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  // Clear user-session-specific banner states when the logged-in user changes
  // so one user's sync errors don't bleed into the next user's session.
  useEffect(() => {
    setState((prev) => {
      const sessionStates: BannerState[] = ['syncing', 'sync-complete', 'sync-failed', 'facility-cached']
      return sessionStates.includes(prev) ? 'hidden' : prev
    })
    setSyncResult(null)
  }, [user?.id])

  useEffect(() => {
    if (!navigator.onLine) {
      setState('offline')
      setOfflineSince(new Date())
    }

    const handleOffline = () => {
      setState('offline')
      setOfflineSince(new Date())
    }

    const handleOnline = () => {
      if (pendingCount() > 0) {
        // useOfflineSync will dispatch pwa:syncing shortly — wait for it
        setState('syncing')
      } else {
        setState('back-online')
        setTimeout(() => setState('hidden'), 4000)
      }
    }

    const handleSyncing = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail.count
      setState('syncing')
      setSyncResult({ synced: 0, failed: [] })
      // Attach count to result for display
      setSyncResult((prev) => ({ ...(prev ?? { failed: [] }), synced: count }))
    }

    const handleSyncComplete = (e: Event) => {
      const { synced, failed } = (e as CustomEvent<SyncResult>).detail
      setSyncResult({ synced, failed })
      if (failed.length > 0) {
        setState('sync-failed')
      } else if (synced > 0) {
        setState('sync-complete')
        setTimeout(() => setState('hidden'), 6000)
      } else {
        // synced=0, no permanent failures — items still queued, retry silently
        setState('hidden')
      }
    }

    const handleFacilityCached = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail.count
      // Only show if not already showing something more urgent
      setState((prev) =>
        prev === 'hidden' || prev === 'back-online' || prev === 'offline-ready'
          ? 'facility-cached'
          : prev,
      )
      // Stash count for display — reuse syncResult slot
      setSyncResult({ synced: count, failed: [] })
      setTimeout(() => setState((prev) => (prev === 'facility-cached' ? 'hidden' : prev)), 5000)
    }

    const handleOfflineReady = () => {
      setState('offline-ready')
      setTimeout(() => setState('hidden'), 5000)
    }

    const handleUpdateAvailable = () => {
      setState('update-available')
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('pwa:syncing', handleSyncing)
    window.addEventListener('pwa:sync-complete', handleSyncComplete)
    window.addEventListener('pwa:facility-cached', handleFacilityCached)
    window.addEventListener('pwa:offline-ready', handleOfflineReady)
    window.addEventListener('pwa:update-available', handleUpdateAvailable)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('pwa:syncing', handleSyncing)
      window.removeEventListener('pwa:sync-complete', handleSyncComplete)
      window.removeEventListener('pwa:facility-cached', handleFacilityCached)
      window.removeEventListener('pwa:offline-ready', handleOfflineReady)
      window.removeEventListener('pwa:update-available', handleUpdateAvailable)
    }
  }, [])

  if (state === 'hidden') return null

  if (state === 'offline') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <WifiOff size={15} className="shrink-0" />
        <span>
          You are offline.{' '}
          <span className="font-normal opacity-90">
            Patient records loaded before{' '}
            {offlineSince
              ? offlineSince.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'going offline'}{' '}
            are available. New registrations will be saved and synced when you reconnect.
          </span>
        </span>
      </div>
    )
  }

  if (state === 'syncing') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <UploadCloud size={15} className="shrink-0 animate-pulse" />
        Syncing patient records saved while offline…
      </div>
    )
  }

  if (state === 'sync-complete') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <CheckCircle size={15} className="shrink-0" />
        {syncResult?.synced === 1
          ? '1 patient record synced successfully.'
          : `${syncResult?.synced} patient records synced successfully.`}
      </div>
    )
  }

  if (state === 'sync-failed') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <AlertTriangle size={15} className="shrink-0" />
        <span>
          {syncResult?.synced ? `${syncResult.synced} synced. ` : ''}
          Could not sync:{' '}
          <span className="font-normal">{syncResult?.failed.join(', ')}</span>
          {' — '}please re-register these patients.
        </span>
        <button
          onClick={() => setState('hidden')}
          className="ml-1 text-xs opacity-75 hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    )
  }

  if (state === 'facility-cached') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-slate-700 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <DatabaseZap size={15} className="shrink-0" />
        {syncResult?.synced === 1
          ? '1 patient record cached — available offline.'
          : `${syncResult?.synced ?? 0} patient records cached — available offline.`}
      </div>
    )
  }

  if (state === 'back-online') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <Wifi size={15} className="shrink-0" />
        Back online — data will refresh automatically.
      </div>
    )
  }

  if (state === 'update-available') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <RefreshCw size={15} className="shrink-0" />
        <span>A new version of PulseSync is available.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded border border-white/40 px-2.5 py-0.5 text-xs hover:bg-white/20"
        >
          Refresh now
        </button>
        <button
          onClick={() => setState('hidden')}
          className="ml-1 text-xs opacity-70 hover:opacity-100"
        >
          Later
        </button>
      </div>
    )
  }

  if (state === 'offline-ready') {
    return (
      <div className="w-full z-50 flex items-center justify-center gap-3 bg-slate-700 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <Download size={15} className="shrink-0" />
        PulseSync is ready to work offline — patient data will be cached automatically.
      </div>
    )
  }

  return null
}
