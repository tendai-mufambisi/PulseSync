import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { getPending, removePendingAndNotify, incrementAttempts } from '../lib/offlineQueue'

// 409 Conflict (duplicate national ID already in DB) is the only truly
// permanent failure — retrying will never fix it.
const MAX_ATTEMPTS = 5

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function ensureAuth(): Promise<boolean> {
  try {
    await api.get('/auth/me/')
    return true
  } catch {
    return false
  }
}

// enabled must be true before any sync attempt runs — pass !!user from the layout
export function useOfflineSync(enabled: boolean) {
  const queryClient = useQueryClient()
  const syncingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const flush = async () => {
      if (syncingRef.current) return
      const pending = getPending()
      if (pending.length === 0) return

      // Let the network stabilise, then confirm auth is live so the token is
      // refreshed before we fire any writes.
      await sleep(1500)
      const authed = await ensureAuth()
      if (!authed) return

      syncingRef.current = true
      window.dispatchEvent(new CustomEvent('pwa:syncing', { detail: { count: pending.length } }))

      let synced = 0
      const permanentlyFailed: string[] = []

      for (const item of pending) {
        try {
          await api.post('/patients/', item.payload)
          removePendingAndNotify(item.id)
          synced++
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status

          if (status === 409) {
            // Duplicate record — will never succeed, discard and report.
            removePendingAndNotify(item.id)
            permanentlyFailed.push(item.label)
          } else {
            // Transient error — leave in queue, increment attempt counter.
            incrementAttempts(item.id)
            const updated = getPending().find((p) => p.id === item.id)
            if (updated && updated.attempts >= MAX_ATTEMPTS) {
              removePendingAndNotify(item.id)
              permanentlyFailed.push(item.label)
            }
          }
        }
      }

      syncingRef.current = false

      if (synced > 0) {
        queryClient.invalidateQueries({ queryKey: ['patients'] })
      }

      // Only fire the completion event when there is something meaningful to
      // report. If synced=0 and nothing permanently failed, items are still in
      // the queue and will retry silently on the next reconnect — showing a
      // "0 patients synced" banner would be confusing.
      if (synced > 0 || permanentlyFailed.length > 0) {
        window.dispatchEvent(
          new CustomEvent('pwa:sync-complete', { detail: { synced, failed: permanentlyFailed } }),
        )
      }
    }

    if (navigator.onLine) flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [enabled, queryClient])
}
