import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { getPending, removePending } from '../lib/offlineQueue'

export function useOfflineSync() {
  const queryClient = useQueryClient()
  const syncingRef = useRef(false)

  const flush = async () => {
    if (syncingRef.current) return
    const pending = getPending()
    if (pending.length === 0) return

    syncingRef.current = true
    window.dispatchEvent(new CustomEvent('pwa:syncing', { detail: { count: pending.length } }))

    let synced = 0
    const failed: string[] = []

    for (const item of pending) {
      try {
        await api.post('/patients/', item.payload)
        removePending(item.id)
        synced++
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500) {
          // Validation error — won't succeed on retry, discard and report
          removePending(item.id)
          failed.push(item.label)
        }
        // Network / 5xx — leave for next reconnect
      }
    }

    syncingRef.current = false

    if (synced > 0) {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    }

    window.dispatchEvent(new CustomEvent('pwa:sync-complete', { detail: { synced, failed } }))
  }

  useEffect(() => {
    if (navigator.onLine) flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
