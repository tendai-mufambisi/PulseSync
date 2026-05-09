import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

interface RoleGateProps {
  roles: UserRole[]
  fallback?: ReactNode
  children: ReactNode
}

export function RoleGate({ roles, fallback = null, children }: RoleGateProps) {
  const { hasRole } = useAuth()
  return hasRole(...roles) ? <>{children}</> : <>{fallback}</>
}
