import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '../hooks/useAuth'
import { OfflineBanner } from '../components/OfflineBanner'

export const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <OfflineBanner />
        <div className="flex flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </AuthProvider>
  ),
})
