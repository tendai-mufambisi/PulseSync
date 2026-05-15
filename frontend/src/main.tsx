import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import { registerSW } from 'virtual:pwa-register'
import { routeTree } from './routeTree'
import './styles.css'

// ── Service Worker registration ───────────────────────────────────────────────
registerSW({
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('pwa:offline-ready'))
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa:update-available'))
  },
})

// ── React Query ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
      staleTime: 2 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'online',
    },
  },
})

// ── IndexedDB persister ───────────────────────────────────────────────────────
// Serialises the React Query cache to IndexedDB so patient data survives a
// full page refresh while offline. Only 'patients' and 'hospitals' queries
// are persisted — auth state is excluded (tokens live in localStorage already).
const idbPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: 'pulsesync-query-cache',
  // Throttle writes to IDB — at most once per 2 seconds.
  throttleTime: 2000,
})

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0]
            return key === 'patients' || key === 'hospitals'
          },
        },
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)
