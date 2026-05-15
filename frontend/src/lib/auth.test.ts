/**
 * Tests for the auth token and user-cache utilities (lib/auth.ts).
 *
 * These functions are critical for the offline login feature: the last
 * authenticated user's profile is cached in localStorage so nurses can
 * continue working on the same device when internet is unavailable.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  saveLastUser,
  getLastUser,
  clearLastUser,
} from './auth'
import type { AuthUser } from '../types'

const SAMPLE_USER: AuthUser = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  email: 'nurse@cityhospital.co.zw',
  full_name: 'Grace Moyo',
  role: 'nurse',
  hospital: 'hosp-uuid-123',
  hospital_name: 'City Hospital',
  must_change_password: false,
  is_active: true,
  created_at: '2026-01-01T08:00:00Z',
}

const ACCESS = 'eyJhbGciOiJIUzI1NiJ9.access'
const REFRESH = 'eyJhbGciOiJIUzI1NiJ9.refresh'

// Reset localStorage before each test.
beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

describe('getAccessToken', () => {
  it('returns null when no token has been stored', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('returns the stored access token after setTokens', () => {
    setTokens(ACCESS, REFRESH)
    expect(getAccessToken()).toBe(ACCESS)
  })
})

describe('getRefreshToken', () => {
  it('returns null when no token has been stored', () => {
    expect(getRefreshToken()).toBeNull()
  })

  it('returns the stored refresh token after setTokens', () => {
    setTokens(ACCESS, REFRESH)
    expect(getRefreshToken()).toBe(REFRESH)
  })
})

describe('setTokens', () => {
  it('stores both access and refresh tokens in localStorage', () => {
    setTokens(ACCESS, REFRESH)
    expect(localStorage.getItem('ps_access')).toBe(ACCESS)
    expect(localStorage.getItem('ps_refresh')).toBe(REFRESH)
  })

  it('overwrites previously stored tokens', () => {
    setTokens('old-access', 'old-refresh')
    setTokens(ACCESS, REFRESH)
    expect(getAccessToken()).toBe(ACCESS)
    expect(getRefreshToken()).toBe(REFRESH)
  })
})

describe('clearTokens', () => {
  it('removes both tokens from localStorage', () => {
    setTokens(ACCESS, REFRESH)
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('is a no-op when no tokens are stored', () => {
    expect(() => clearTokens()).not.toThrow()
  })

  it('does not remove unrelated localStorage keys', () => {
    localStorage.setItem('other-key', 'other-value')
    setTokens(ACCESS, REFRESH)
    clearTokens()
    expect(localStorage.getItem('other-key')).toBe('other-value')
  })
})

// ---------------------------------------------------------------------------
// Offline user cache
// ---------------------------------------------------------------------------

describe('saveLastUser', () => {
  it('persists the user object to localStorage as JSON', () => {
    saveLastUser(SAMPLE_USER)
    const raw = localStorage.getItem('ps_last_user')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toMatchObject({ email: SAMPLE_USER.email })
  })

  it('overwrites a previously cached user', () => {
    saveLastUser(SAMPLE_USER)
    const admin: AuthUser = { ...SAMPLE_USER, email: 'admin@example.com', role: 'hospital_admin' }
    saveLastUser(admin)
    expect(getLastUser()?.email).toBe('admin@example.com')
  })
})

describe('getLastUser', () => {
  it('returns null when no user has been cached', () => {
    expect(getLastUser()).toBeNull()
  })

  it('returns the full user object that was saved', () => {
    saveLastUser(SAMPLE_USER)
    const restored = getLastUser()
    expect(restored).not.toBeNull()
    expect(restored!.id).toBe(SAMPLE_USER.id)
    expect(restored!.email).toBe(SAMPLE_USER.email)
    expect(restored!.full_name).toBe(SAMPLE_USER.full_name)
    expect(restored!.role).toBe(SAMPLE_USER.role)
    expect(restored!.hospital_name).toBe(SAMPLE_USER.hospital_name)
  })

  it('returns null when localStorage contains malformed JSON', () => {
    localStorage.setItem('ps_last_user', '{not valid json')
    expect(getLastUser()).toBeNull()
  })

  it('returns null when ps_last_user is explicitly "null"', () => {
    localStorage.setItem('ps_last_user', 'null')
    expect(getLastUser()).toBeNull()
  })

  it('preserves the must_change_password flag', () => {
    saveLastUser({ ...SAMPLE_USER, must_change_password: true })
    expect(getLastUser()?.must_change_password).toBe(true)
  })

  it('preserves the is_active flag', () => {
    saveLastUser({ ...SAMPLE_USER, is_active: false })
    expect(getLastUser()?.is_active).toBe(false)
  })
})

describe('clearLastUser', () => {
  it('removes the cached user from localStorage', () => {
    saveLastUser(SAMPLE_USER)
    clearLastUser()
    expect(getLastUser()).toBeNull()
  })

  it('is a no-op when no user is cached', () => {
    expect(() => clearLastUser()).not.toThrow()
  })

  it('does not remove unrelated localStorage entries', () => {
    localStorage.setItem('some-other-key', 'value')
    saveLastUser(SAMPLE_USER)
    clearLastUser()
    expect(localStorage.getItem('some-other-key')).toBe('value')
  })
})

// ---------------------------------------------------------------------------
// Combined offline login flow
// ---------------------------------------------------------------------------

describe('offline login flow', () => {
  it('tokens and user survive a simulated sign-in and remain after re-read', () => {
    // Step 1 – user signs in online
    setTokens(ACCESS, REFRESH)
    saveLastUser(SAMPLE_USER)

    // Step 2 – device goes offline; app re-reads from storage
    const token = getAccessToken()
    const user = getLastUser()

    expect(token).toBe(ACCESS)
    expect(user?.email).toBe(SAMPLE_USER.email)
  })

  it('signing out clears both tokens and the cached user', () => {
    setTokens(ACCESS, REFRESH)
    saveLastUser(SAMPLE_USER)

    // Simulate signOut()
    clearTokens()
    clearLastUser()

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(getLastUser()).toBeNull()
  })
})
