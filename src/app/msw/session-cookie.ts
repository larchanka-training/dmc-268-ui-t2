import type { MeWire } from '@/entities/session/model/types'

/** Cookie name for MSW session. Browser SW cannot set HttpOnly; SameSite=Lax matches intent. */
export const MSW_SESSION_COOKIE = 'dmc_session'
export const MSW_OAUTH_STATE = 'msw-oauth-state'
export const MSW_CSRF_TOKEN = 'msw-csrf-token'

/** Mutable session expiry for MSW refresh demos (ISO). */
let mswExpiresAt = defaultExpiresAt()

function defaultExpiresAt(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString()
}

export function mockMeWire(): MeWire {
  return {
    user: {
      id: 'user-1',
      provider: 'github',
      external_id: '1',
      login: 'ada',
    },
    session: {
      expires_at: mswExpiresAt,
    },
    csrf_token: MSW_CSRF_TOKEN,
  }
}

export function extendMswSessionExpiry(minutes = 30): string {
  mswExpiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  return mswExpiresAt
}

export function resetMswSessionExpiry(): void {
  mswExpiresAt = defaultExpiresAt()
}

export function readSessionCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${MSW_SESSION_COOKIE}=([^;]*)`))
  return match?.[1]
}

export function setSessionCookie(): void {
  document.cookie = `${MSW_SESSION_COOKIE}=ok; Path=/; SameSite=Lax`
  resetMswSessionExpiry()
}

export function clearSessionCookie(): void {
  document.cookie = `${MSW_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  resetMswSessionExpiry()
}
