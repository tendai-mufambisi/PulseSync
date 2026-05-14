import { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw, Download } from 'lucide-react'

type BannerState = 'hidden' | 'offline' | 'back-online' | 'update-available' | 'offline-ready'

export function OfflineBanner() {
  const [state, setState] = useState<BannerState>('hidden')
  const [offlineSince, setOfflineSince] = useState<Date | null>(null)

  useEffect(() => {
    // Initial check
    if (!navigator.onLine) {
      setState('offline')
      setOfflineSince(new Date())
    }

    const handleOffline = () => {
      setState('offline')
      setOfflineSince(new Date())
    }

    const handleOnline = () => {
      setState('back-online')
      // Hide the "back online" message after 4 seconds
      setTimeout(() => setState('hidden'), 4000)
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
    window.addEventListener('pwa:offline-ready', handleOfflineReady)
    window.addEventListener('pwa:update-available', handleUpdateAvailable)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('pwa:offline-ready', handleOfflineReady)
      window.removeEventListener('pwa:update-available', handleUpdateAvailable)
    }
  }, [])

  if (state === 'hidden') return null

  if (state === 'offline') {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <WifiOff size={15} className="shrink-0" />
        <span>
          You are offline.{' '}
          <span className="font-normal opacity-90">
            Patient records loaded before{' '}
            {offlineSince
              ? offlineSince.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'going offline'}{' '}
            are available for reading. Saves are paused until reconnected.
          </span>
        </span>
      </div>
    )
  }

  if (state === 'back-online') {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <Wifi size={15} className="shrink-0" />
        Back online — data will refresh automatically.
      </div>
    )
  }

  if (state === 'update-available') {
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-md">
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
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-slate-700 px-4 py-2.5 text-sm font-medium text-white shadow-md">
        <Download size={15} className="shrink-0" />
        PulseSync is ready to work offline — patient data will be cached automatically.
      </div>
    )
  }

  return null
}
