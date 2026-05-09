import { createRoute, Navigate } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { getAccessToken } from '../lib/auth'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => {
    const token = getAccessToken()
    return <Navigate to={token ? '/dashboard' : '/login'} replace />
  },
})
