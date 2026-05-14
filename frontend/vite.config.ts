import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg'],

      manifest: {
        name: 'PulseSync — Clinical EHR',
        short_name: 'PulseSync',
        description: 'Longitudinal healthcare record platform with offline support',
        theme_color: '#0284c7',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Precache all built assets (JS, CSS, HTML, fonts, images)
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff,woff2}'],

        // SPA navigation: always serve index.html for non-API routes
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // ── Google Fonts ── Cache First, expires 1 year
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },

          // ── Emergency endpoints ── Stale While Revalidate
          // Speed is critical; serve cache instantly, update in background.
          // 48h expiry so paramedics offline overnight still have data.
          {
            urlPattern: /\/api\/patients\/.*\/emergency\//,
            handler: 'StaleWhileRevalidate',
            method: 'GET',
            options: {
              cacheName: 'api-emergency',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 48,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Patient detail and timeline ── Network First, 24h fallback
          // Try the network first (fresh data). If offline or >5s, serve cache.
          {
            urlPattern: /\/api\/patients\//,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-patients',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Hospital list ── Network First, 12h fallback
          // Needed for dropdowns; changes infrequently.
          {
            urlPattern: /\/api\/hospitals\//,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-hospitals',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 12,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Auth (me, users) ── Network First, short cache
          // Keep a short cache so the sidebar stays populated offline.
          {
            urlPattern: /\/api\/auth\/(me|users|staff)\//,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-auth',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 4,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        // Disabled in dev — service workers interfere with hot reload.
        // To test offline: run `npm run build && npm run preview`, then
        // open DevTools → Application → Service Workers → tick "Offline".
        enabled: false,
      },
    }),
  ],

  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
