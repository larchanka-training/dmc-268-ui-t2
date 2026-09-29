import { http, HttpResponse } from 'msw'
import { AUTH_GITHUB_CALLBACK_PATH, AUTH_GITHUB_START_PATH, AUTH_LOGOUT_PATH, ME_PATH } from '@/entities/session'
import {
  MSW_OAUTH_STATE,
  MSW_SESSION_COOKIE,
  clearSessionCookie,
  mockMeUser,
  readSessionCookie,
  setSessionCookie,
} from '@/app/msw/session-cookie'

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
    const session = cookies[MSW_SESSION_COOKIE] ?? readSessionCookie()
    if (session !== 'ok') {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json(mockMeUser)
  }),

  http.post(AUTH_LOGOUT_PATH, () => {
    clearSessionCookie()
    return new HttpResponse(null, { status: 204 })
  }),
]
