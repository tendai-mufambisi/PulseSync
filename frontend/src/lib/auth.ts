import type { AuthUser } from '../types'

const ACCESS_KEY = 'ps_access'
const REFRESH_KEY = 'ps_refresh'
const LAST_USER_KEY = 'ps_last_user'

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_KEY)
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY)

export const setTokens = (access: string, refresh: string): void => {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export const saveLastUser = (user: AuthUser): void => {
  localStorage.setItem(LAST_USER_KEY, JSON.stringify(user))
}

export const getLastUser = (): AuthUser | null => {
  try {
    return JSON.parse(localStorage.getItem(LAST_USER_KEY) ?? 'null')
  } catch {
    return null
  }
}

export const clearLastUser = (): void => {
  localStorage.removeItem(LAST_USER_KEY)
}
