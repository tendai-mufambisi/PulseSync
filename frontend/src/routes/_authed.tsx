import { createRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { rootRoute } from './__root'
import { useAuth } from '../hooks/useAuth'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { usePrefetchFacilityPatients } from '../hooks/usePrefetchFacilityPatients'
import { Sidebar } from '../components/Sidebar'
import { PageSpinner } from '../components/States'

export const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  useOfflineSync(!!user)
  usePrefetchFacilityPatients(!!user)

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate({ to: '/login', replace: true })
    } else if (user.must_change_password) {
      navigate({ to: '/change-password', replace: true })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageSpinner />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
