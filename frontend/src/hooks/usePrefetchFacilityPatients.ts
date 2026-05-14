import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { PatientListItem, Patient } from '../types'

type PagedResponse = { results: PatientListItem[]; next: string | null }

const DETAIL_PREFETCH_LIMIT = 100
const DETAIL_BATCH_SIZE = 5
const DETAIL_BATCH_DELAY_MS = 300

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function usePrefetchFacilityPatients(enabled: boolean) {
  const queryClient = useQueryClient()
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!enabled || hasFetched.current) return
    hasFetched.current = true

    const prefetch = async () => {
      try {
        // ── Step 1: fetch all pages of the facility patient list ──────────────
        const all: PatientListItem[] = []
        let next: string | null = '/patients/'

        while (next) {
          const response: { data: PatientListItem[] | PagedResponse } =
            await api.get<PatientListItem[] | PagedResponse>(next)
          const responseData: PatientListItem[] | PagedResponse = response.data

          const results: PatientListItem[] = Array.isArray(responseData)
            ? responseData
            : responseData.results
          all.push(...results)

          const nextUrl: string | null = Array.isArray(responseData) ? null : responseData.next
          if (!nextUrl || all.length >= 5000) break
          next = nextUrl.replace(/^https?:\/\/[^/]+/, '')
        }

        // Populate the list query — the patients list page reads ['patients', '']
        queryClient.setQueryData(['patients', ''], all)

        // ── Step 2: prefetch individual detail pages in small batches ─────────
        const toFetch = all.slice(0, DETAIL_PREFETCH_LIMIT)

        for (let i = 0; i < toFetch.length; i += DETAIL_BATCH_SIZE) {
          const batch = toFetch.slice(i, i + DETAIL_BATCH_SIZE)
          await Promise.all(
            batch.map((p) =>
              queryClient.prefetchQuery({
                queryKey: ['patient', p.id],
                queryFn: async () => {
                  const { data } = await api.get<Patient>(`/patients/${p.id}/`)
                  return data
                },
                // Don't re-fetch if already fresh in cache
                staleTime: 2 * 60 * 1000,
              }),
            ),
          )
          if (i + DETAIL_BATCH_SIZE < toFetch.length) {
            await sleep(DETAIL_BATCH_DELAY_MS)
          }
        }

        window.dispatchEvent(
          new CustomEvent('pwa:facility-cached', { detail: { count: all.length } }),
        )
      } catch {
        // Best-effort — silently ignore any failure
      }
    }

    prefetch()
  }, [enabled, queryClient])
}
