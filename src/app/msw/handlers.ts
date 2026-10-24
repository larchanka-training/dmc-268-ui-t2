import { http, HttpResponse } from 'msw'
import { sse } from 'msw/sse'
import {
  AUTH_GITHUB_CALLBACK_PATH,
  AUTH_GITHUB_START_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_REFRESH_PATH,
  ME_PATH,
} from '@/entities/session'
import { REPOSITORIES_AVAILABLE_PATH, REPOSITORIES_CONNECT_PATH, REPOSITORIES_PATH } from '@/entities/repository'
import {
  MSW_CSRF_TOKEN,
  MSW_OAUTH_STATE,
  MSW_SESSION_COOKIE,
  clearSessionCookie,
  extendMswSessionExpiry,
  mockMeWire,
  readSessionCookie,
  setSessionCookie,
} from '@/app/msw/session-cookie'
import {
  connectRepositoryInStore,
  listAvailableRepositoryPage,
  listConnectedRepositoryPage,
} from '@/app/msw/repos-store'
import {
  hasCapturedDiff,
  mockReviewDiffWire,
  mockReviewFindingsWire,
  reviewDetailWire,
  reviewSnapshotWire,
} from '@/app/msw/review-store'
import { resolveReturnUrl } from '@/shared/lib/return-url'

function isAuthenticated(cookies: Record<string, string>): boolean {
  const session = cookies[MSW_SESSION_COOKIE] ?? readSessionCookie()
  return session === 'ok'
}

function readCsrf(request: Request): string | null {
  return request.headers.get('X-CSRF-Token')
}

function requireCsrf(request: Request): boolean {
  return readCsrf(request) === MSW_CSRF_TOKEN
}

/**
 * Stubbed `/auth/*` + `/me` seams (MSW mirrors OpenAPI until real handlers).
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
    // Accept return_to (validated) so the real query contract is exercised; MSW state is fixed.
    resolveReturnUrl(url.searchParams.get('return_to'))
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
    return HttpResponse.json(mockMeWire())
  }),

  http.post(AUTH_REFRESH_PATH, ({ cookies, request }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    if (!requireCsrf(request)) {
      return new HttpResponse(null, { status: 403 })
    }
    extendMswSessionExpiry(30)
    return HttpResponse.json(mockMeWire())
  }),

  http.post(AUTH_LOGOUT_PATH, ({ cookies, request }) => {
    if (isAuthenticated(cookies) && !requireCsrf(request)) {
      return new HttpResponse(null, { status: 403 })
    }
    clearSessionCookie()
    return new HttpResponse(null, { status: 204 })
  }),
]

/**
 * Stubbed repos seams (OpenAPI page envelopes + snake_case connect):
 * - GET  /api/v1/repositories
 * - GET  /api/v1/repositories/available
 * - POST /api/v1/repositories/connect
 */
export const reposHandlers = [
  http.get(REPOSITORIES_PATH, ({ cookies }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json(listConnectedRepositoryPage())
  }),

  http.get(REPOSITORIES_AVAILABLE_PATH, ({ cookies }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json(listAvailableRepositoryPage())
  }),

  http.post(REPOSITORIES_CONNECT_PATH, async ({ cookies, request }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    if (!requireCsrf(request)) {
      return new HttpResponse(null, { status: 403 })
    }
    const body = (await request.json()) as { provider?: string; external_id?: string }
    if (body?.provider !== 'github' || !body.external_id || !/^[1-9][0-9]*$/.test(body.external_id)) {
      return new HttpResponse(null, { status: 422 })
    }
    const result = connectRepositoryInStore(body.provider, body.external_id)
    if (result.status === 'not_found') {
      return new HttpResponse(null, { status: 422 })
    }
    return HttpResponse.json(result.repository, { status: result.status === 'created' ? 201 : 200 })
  }),
]

const REVIEW_PATH = '/api/v1/reviews/:reviewId'
const SNAPSHOT_TICK_MS = 250

function notFound() {
  return HttpResponse.json(
    {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Review is unavailable.',
      request_id: 'msw',
      retryable: false,
      retry_after: null,
    },
    { status: 404 },
  )
}

/**
 * Stubbed reviews seams (see `review-store.ts` for the scenarios):
 * - GET /api/v1/reviews/{id}
 * - GET /api/v1/reviews/{id}/diff
 * - GET /api/v1/reviews/{id}/findings
 * - GET /api/v1/reviews/{id}/events/stream (SSE `review.snapshot`)
 */
export const reviewsHandlers = [
  http.get(REVIEW_PATH, ({ cookies, params }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    const review = reviewDetailWire(String(params.reviewId))
    return review ? HttpResponse.json(review) : notFound()
  }),

  http.get(`${REVIEW_PATH}/diff`, ({ cookies, params }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    return hasCapturedDiff(String(params.reviewId)) ? HttpResponse.json(mockReviewDiffWire) : notFound()
  }),

  http.get(`${REVIEW_PATH}/findings`, ({ cookies, params }) => {
    if (!isAuthenticated(cookies)) {
      return new HttpResponse(null, { status: 401 })
    }
    const review = reviewDetailWire(String(params.reviewId))
    if (!review) {
      return notFound()
    }
    const done = review.status === 'COMPLETED' || review.status === 'PARTIAL'
    return HttpResponse.json({ items: done ? mockReviewFindingsWire : [], next_cursor: null })
  }),

  sse<{ 'review.snapshot': unknown }>(`${REVIEW_PATH}/events/stream`, ({ client, cookies, params }) => {
    const reviewId = String(params.reviewId)
    if (!isAuthenticated(cookies) || reviewId === 'demo-review-polling' || !reviewSnapshotWire(reviewId)) {
      // EventSource sees a failed connection; the UI must fall back to polling.
      client.error()
      return
    }
    let lastSequence = -1
    const tick = () => {
      const snapshot = reviewSnapshotWire(reviewId)
      const review = reviewDetailWire(reviewId)
      if (!snapshot || !review) {
        client.close()
        return
      }
      if (snapshot.sequence !== lastSequence) {
        lastSequence = snapshot.sequence
        client.send({ event: 'review.snapshot', data: snapshot })
      }
      const settled =
        review.finished_at !== null &&
        (snapshot.publication_status === 'PUBLISHED' ||
          (snapshot.status === 'FAILED' && snapshot.publication_status === 'NOT_READY'))
      if (settled) {
        client.close()
        return
      }
      setTimeout(tick, SNAPSHOT_TICK_MS)
    }
    tick()
  }),
]
