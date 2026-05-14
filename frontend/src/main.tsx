import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import { routeTree } from './routeTree'
import './styles.css'

// ── Service Worker registration ───────────────────────────────────────────────
// The service worker caches the app shell and patient API responses.
// When a new version is deployed, the SW updates silently on next load.
// In dev mode the SW is disabled (see vite.config.ts devOptions).
registerSW({
  onOfflineReady() {
    // App is fully cached and ready to work offline.
    window.dispatchEvent(new CustomEvent('pwa:offline-ready'))
  },
  onNeedRefresh() {
    // A new version of the app is available (SW updated).
    window.dispatchEvent(new CustomEvent('pwa:update-available'))
  },
})

// ── React Query ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 4xx errors — only retry network failures.
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
      // Keep data fresh for 2 minutes before background-refetching.
      staleTime: 2 * 60 * 1000,
      // Hold unused data in memory for 24 hours.
      // Combined with the service worker cache, this means offline users
      // keep seeing data they've already loaded even after a page refresh.
      gcTime: 24 * 60 * 60 * 1000,
      // If a query fails because we're offline, show whatever is in cache
      // rather than an error screen.
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Mutations (writes) are always online-only — clinical data must persist
      // to the server. The offline banner makes this clear to the user.
      networkMode: 'online',
    },
  },
})

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
