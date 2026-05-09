import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '../hooks/useAuth'
import { OfflineBanner } from '../components/OfflineBanner'

export const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <OfflineBanner />
      <Outlet />
    </AuthProvider>
  ),
})
