import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { setTokens, clearTokens, getAccessToken } from '../lib/auth'
import type { AuthUser, UserRole } from '../types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  isSystemAdmin: boolean
  isHospitalAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  refreshUser: () => Promise<void>
  hasRole: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<AuthUser>('/auth/me/')
      setUser(data)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getAccessToken()) {
      fetchMe()
    } else {
      setLoading(false)
    }
  }, [fetchMe])

  const signIn = async (email: string, password: string) => {
    const { data } = await api.post<{ access: string; refresh: string }>('/auth/login/', {
      email,
      password,
    })
    setTokens(data.access, data.refresh)
    const me = await api.get<AuthUser>('/auth/me/')
    setUser(me.data)
  }

  const signOut = () => {
    clearTokens()
    setUser(null)
  }

  const hasRole = (...roles: UserRole[]): boolean =>
    user !== null && roles.includes(user.role)

  const isSystemAdmin = user?.role === 'system_admin'
  const isHospitalAdmin = user?.role === 'hospital_admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSystemAdmin: !!isSystemAdmin,
        isHospitalAdmin: !!isHospitalAdmin,
        signIn,
        signOut,
        refreshUser: fetchMe,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
