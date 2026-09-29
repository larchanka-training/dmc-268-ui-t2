import type { MeUser } from '@/entities/session'

/** Cookie name for MSW session. Browser SW cannot set HttpOnly; SameSite=Lax matches Spec 01 intent. */
export const MSW_SESSION_COOKIE = 'dmc_session'
export const MSW_OAUTH_STATE = 'msw-oauth-state'

export const mockMeUser: MeUser = {
  id: 'user-1',
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
  provider: 'github',
  capabilities: ['repos:read'],
}

export function readSessionCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${MSW_SESSION_COOKIE}=([^;]*)`))
  return match?.[1]
}

export function setSessionCookie(): void {
  document.cookie = `${MSW_SESSION_COOKIE}=ok; Path=/; SameSite=Lax`
}

export function clearSessionCookie(): void {
  document.cookie = `${MSW_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}
