import type { Me, MeWire } from '@/entities/session/model/types'
import { parseMe } from '@/entities/session/model/types'
import { AUTH_GITHUB_START_PATH, AUTH_LOGOUT_PATH, AUTH_REFRESH_PATH, ME_PATH } from '@/entities/session/model/paths'
import { resolveReturnUrl } from '@/shared/lib/return-url'

const RETURN_URL_KEY = 'dmc.auth.returnUrl'

export class SessionHttpError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Session request failed (${status})`)
    this.name = 'SessionHttpError'
    this.status = status
  }
}

async function sessionFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
  })
}

function csrfHeaders(csrfToken: string | null | undefined): HeadersInit {
  if (!csrfToken) return {}
  return { 'X-CSRF-Token': csrfToken }
}

async function readMeResponse(response: Response): Promise<Me> {
  if (response.status === 401) {
    throw new SessionHttpError(401, 'Unauthenticated')
  }
  if (!response.ok) {
    throw new SessionHttpError(response.status)
  }
  const wire = (await response.json()) as MeWire
  return parseMe(wire)
}

/** Stash a safe return path across the OAuth full-document navigation. */
export function rememberReturnUrl(raw: string | null | undefined): void {
  const resolved = resolveReturnUrl(raw)
  if (resolved === '/repos') {
    sessionStorage.removeItem(RETURN_URL_KEY)
    return
  }
  sessionStorage.setItem(RETURN_URL_KEY, resolved)
}

export function consumeReturnUrl(): string {
  const raw = sessionStorage.getItem(RETURN_URL_KEY)
  sessionStorage.removeItem(RETURN_URL_KEY)
  return resolveReturnUrl(raw)
}

/** Full-document navigation to start GitHub OAuth (MSW loopback until real handlers). */
export function startGithubOAuth(returnUrl?: string | null): void {
  rememberReturnUrl(returnUrl)
  const returnTo = resolveReturnUrl(returnUrl)
  const url = new URL(AUTH_GITHUB_START_PATH, window.location.origin)
  url.searchParams.set('return_to', returnTo)
  window.location.assign(`${url.pathname}${url.search}`)
}

export async function fetchMe(): Promise<Me> {
  const response = await sessionFetch(ME_PATH)
  return readMeResponse(response)
}

/**
 * Refresh an active session before expiry.
 * Pass CSRF from the last successful `/me` (or prior refresh).
 */
export async function refreshSession(csrfToken: string): Promise<Me> {
  const response = await sessionFetch(AUTH_REFRESH_PATH, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
  })
  return readMeResponse(response)
}

/**
 * Logout. When a session is active, OpenAPI expects CSRF; absent/expired sessions
 * still clear the cookie (CSRF optional for that path).
 */
export async function logoutSession(csrfToken?: string | null): Promise<void> {
  const response = await sessionFetch(AUTH_LOGOUT_PATH, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
  })
  if (!response.ok && response.status !== 204) {
    throw new SessionHttpError(response.status)
  }
}
