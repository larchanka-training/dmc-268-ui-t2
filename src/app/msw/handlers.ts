import { http, HttpResponse } from 'msw'
import { AUTH_GITHUB_CALLBACK_PATH, AUTH_GITHUB_START_PATH, AUTH_LOGOUT_PATH, ME_PATH } from '@/entities/session'
import type { ConnectRepositoryBody } from '@/entities/repository'
import { REPOSITORIES_AVAILABLE_PATH, REPOSITORIES_CONNECT_PATH, REPOSITORIES_PATH } from '@/entities/repository'
import {
  MSW_OAUTH_STATE,
  MSW_SESSION_COOKIE,
  clearSessionCookie,
  mockMeUser,
  readSessionCookie,
  setSessionCookie,
} from '@/app/msw/session-cookie'
import { connectRepositoryInStore, listAvailableRepositories, listConnectedRepositories } from '@/app/msw/repos-store'

function isAuthenticated(cookies: Record<string, string>): boolean {
  const session = cookies[MSW_SESSION_COOKIE] ?? readSessionCookie()
  return session === 'ok'
}

/**
 * Stubbed `/auth/*` + `/me` seams (MSW-backed until Spec 03 / real API).
 *
 * Happy path: start → callback (sets session cookie) → 302 `/auth/callback`
 * Error variant: `GET .../auth/github/start?simulate=error` → FE callback with `?error=`
 */
export const authHandlers = [
  http.get(AUTH_GITHUB_START_PATH, ({ request }) => {
    const url = new URL(request.url)
    if (url.searchParams.get('simulate') === 'error') {
      return HttpResponse.redirect('/auth/callback?error=access_denied', 302)
    }
    const callback = new URL(AUTH_GITHUB_CALLBACK_PATH, url.origin)
    callback.searchParams.set('code', 'msw-code')
    callback.searchParams.set('state', MSW_OAUTH_STATE)
    return HttpResponse.redirect(callback.toString(), 302)
  }),

  http.get(AUTH_GITHUB_CALLBACK_PATH, ({ request }) => {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      clearSessionCookie()
      return HttpResponse.redirect(`/auth/callback?error=${encodeURIComponent(error)}`, 302)
    }
    if (!code) {
      clearSessionCookie()
      return HttpResponse.redirect('/auth/callback?error=missing_code', 302)
    }
    if (state !== MSW_OAUTH_STATE) {
      clearSessionCookie()
      return HttpResponse.redirect('/auth/callback?error=invalid_state', 302)
    }

    setSessionCookie()
    return HttpResponse.redirect('/auth/callback', 302)
  }),

  http.get(ME_PATH, ({ cookies }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json(mockMeUser)
  }),

  http.post(AUTH_LOGOUT_PATH, () => {
    clearSessionCookie()
    return new HttpResponse(null, { status: 204 })
  }),
]

/**
 * Stubbed repos seams (MSW-backed until Spec 03 / real API):
 * - GET  /api/v1/repositories
 * - GET  /api/v1/repositories/available
 * - POST /api/v1/repositories/connect
 */
export const reposHandlers = [
  http.get(REPOSITORIES_PATH, ({ cookies }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json(listConnectedRepositories())
  }),

  http.get(REPOSITORIES_AVAILABLE_PATH, ({ cookies }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json(listAvailableRepositories())
  }),

  http.post(REPOSITORIES_CONNECT_PATH, async ({ cookies, request }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    const body = (await request.json()) as ConnectRepositoryBody
    if (!body?.provider || !body?.externalId) {
      return new HttpResponse(null, { status: 400 })
    }
    const result = connectRepositoryInStore(body.provider, body.externalId)
    if (result === 'conflict') {
      return new HttpResponse(null, { status: 409 })
    }
    if (result === 'not_found') {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(result, { status: 201 })
  }),
]
