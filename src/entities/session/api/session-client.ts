import type { MeUser } from '@/entities/session/model/types'
import { AUTH_GITHUB_START_PATH, AUTH_LOGOUT_PATH, ME_PATH } from '@/entities/session/model/paths'
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

/** Full-document navigation to start GitHub OAuth (MSW loopback in Spec 01). */
export function startGithubOAuth(returnUrl?: string | null): void {
  rememberReturnUrl(returnUrl)
  window.location.assign(AUTH_GITHUB_START_PATH)
}

export async function fetchMe(): Promise<MeUser> {
  const response = await sessionFetch(ME_PATH)
  if (response.status === 401) {
    throw new SessionHttpError(401, 'Unauthenticated')
  }
  if (!response.ok) {
    throw new SessionHttpError(response.status)
  }
  return (await response.json()) as MeUser
}

export async function logoutSession(): Promise<void> {
  const response = await sessionFetch(AUTH_LOGOUT_PATH, { method: 'POST' })
  if (!response.ok && response.status !== 204) {
    throw new SessionHttpError(response.status)
  }
}
