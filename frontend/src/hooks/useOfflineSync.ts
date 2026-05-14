import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { getPending, removePendingAndNotify } from '../lib/offlineQueue'

// Statuses that mean the payload itself is invalid — retrying will never help.
// 401 (auth) and 403 (permission) are intentionally excluded: they're transient
// conditions that will resolve once the token is refreshed or the user re-auths.
const PERMANENT_FAILURE_STATUSES = new Set([400, 409, 422])

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

export function useOfflineSync() {
  const queryClient = useQueryClient()
  const syncingRef = useRef(false)

  const flush = async () => {
    if (syncingRef.current) return
    const pending = getPending()
    if (pending.length === 0) return

    // Give the network a moment to fully stabilise after coming back online,
    // then confirm auth is live (forces a token refresh if the access token
    // expired while we were offline) before firing any patient writes.
    await sleep(1500)
    const authed = await ensureAuth()
    if (!authed) {
      // Auth isn't ready yet — the online event will fire again or the user
      // will re-navigate, which will trigger another flush attempt.
      return
    }

    syncingRef.current = true
    window.dispatchEvent(new CustomEvent('pwa:syncing', { detail: { count: pending.length } }))

    let synced = 0
    const failed: string[] = []

    for (const item of pending) {
      try {
        await api.post('/patients/', item.payload)
        removePendingAndNotify(item.id)
        synced++
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status

        if (status && PERMANENT_FAILURE_STATUSES.has(status)) {
          // True data/validation error — retrying will never succeed.
          removePendingAndNotify(item.id)
          failed.push(item.label)
        }
        // 401, 403, 5xx, or no response (network) — leave in queue for next attempt.
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
