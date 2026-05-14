import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { getPending, removePendingAndNotify, incrementAttempts } from '../lib/offlineQueue'

// Only a 409 Conflict (e.g. duplicate national ID already in the DB) is truly
// permanent — no amount of retrying will fix it. Every other error (400, 401,
// 403, 5xx, network) is left in the queue and retried next time we reconnect.
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

export function useOfflineSync() {
  const queryClient = useQueryClient()
  const syncingRef = useRef(false)

  const flush = async () => {
    if (syncingRef.current) return
    const pending = getPending()
    if (pending.length === 0) return

    // Let the network stabilise, then confirm auth is live (forces a token
    // refresh if the access token expired while we were offline).
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
          // Conflict — this exact record already exists in the DB (e.g. duplicate
          // national ID). Retrying will never help; discard and report.
          removePendingAndNotify(item.id)
          permanentlyFailed.push(item.label)
        } else {
          // Any other error (400, 401, 403, 5xx, network timeout) — increment
          // the attempt counter and leave in the queue for the next reconnect.
          incrementAttempts(item.id)
          const updated = getPending().find((p) => p.id === item.id)
          if (updated && updated.attempts >= MAX_ATTEMPTS) {
            // Give up after MAX_ATTEMPTS consecutive failures.
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

    window.dispatchEvent(
      new CustomEvent('pwa:sync-complete', { detail: { synced, failed: permanentlyFailed } }),
    )
  }

  useEffect(() => {
    if (navigator.onLine) flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
