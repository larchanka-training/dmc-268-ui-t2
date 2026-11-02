import { http, HttpResponse } from 'msw'
import {
  AUTH_GITHUB_CALLBACK_PATH,
  AUTH_GITHUB_START_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_REFRESH_PATH,
  ME_PATH,
} from '@/entities/session'
import {
  MOCK_DEFAULT_REVIEW_ID,
  MOCK_FETCHING_REVIEW_ID,
  MOCK_PULL_REQUESTS,
  MOCK_REPOSITORY_ID,
  MOCK_REVIEWS,
  MOCK_SKIPPED_REVIEW_ID,
  REPOSITORY_PULL_REQUEST_REVIEWS_ROUTE,
  REPOSITORY_PULL_REQUESTS_ROUTE,
  type PullRequestWire,
  REVIEW_DIFF_ROUTE,
  REVIEW_FINDINGS_ROUTE,
  REVIEW_ROUTE,
} from '@/entities/pull-request'
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
  isConnectedRepositoryId,
  listAvailableRepositoryPage,
  listConnectedRepositoryPage,
} from '@/app/msw/repos-store'
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
    switch (result.status) {
      case 'not_found':
        return new HttpResponse(null, { status: 422 })
      case 'bot_access_required':
        return apiError(409, 'BOT_ACCESS_REQUIRED', 'Invite the review bot to this repository, then check again.', {
          bot_login: result.botLogin,
          access_url: result.accessUrl,
        })
      case 'service_unavailable':
        return apiError(503, 'SERVICE_UNAVAILABLE', 'The review service is temporarily unavailable.', {
          retryable: true,
        })
      default:
        return HttpResponse.json(result.repository, { status: result.status === 'created' ? 201 : 200 })
    }
  }),
]

/** OpenAPI `Error` envelope; `extras` adds fields such as `bot_login` / `access_url` or `retryable`. */
function apiError(
  status: number,
  code: string,
  message: string,
  extras: { retryable?: boolean; bot_login?: string; access_url?: string } = {},
) {
  const { retryable = false, ...rest } = extras
  return HttpResponse.json({ code, message, request_id: 'req_msw', retryable, retry_after: null, ...rest }, { status })
}

const notFound = () => apiError(404, 'RESOURCE_NOT_FOUND', 'Resource was not found.')

/** Reserved demo PR: Start always answers `INTEGRATION_UNHEALTHY`. MSW-only overlay, not a shared fixture. */
const UNHEALTHY_PULL_REQUEST_NUMBER = 999
const MSW_PULL_REQUESTS: PullRequestWire[] = [
  ...MOCK_PULL_REQUESTS,
  {
    ...MOCK_PULL_REQUESTS[0],
    number: UNHEALTHY_PULL_REQUEST_NUMBER,
    title: 'Demo: integration unhealthy on Start',
    state: 'OPEN',
  },
]

/** PR number → fixture review opened after Start. Fixtures keep `repository_id: connected-1001`. */
const REVIEW_ID_BY_PULL_REQUEST: Record<number, string> = {
  42: MOCK_DEFAULT_REVIEW_ID,
  43: MOCK_SKIPPED_REVIEW_ID,
  44: MOCK_FETCHING_REVIEW_ID,
}

/** `MOCK_REPOSITORY_ID` stays valid even when only another repo is connected (review detail re-lists PRs by it). */
const isKnownRepositoryId = (repositoryId: string) =>
  repositoryId === MOCK_REPOSITORY_ID || isConnectedRepositoryId(repositoryId)

/** Keyed by repository id + PR number + Idempotency-Key. Same head sha → 200 replay; different → 409. Resets on reload. */
const startReviewByKey = new Map<string, { headSha: string }>()

/** Test/dev helper — clears the Start idempotency map. */
export function resetMswStartReviewState(): void {
  startReviewByKey.clear()
}

/**
 * Stubbed reviews seams (wire fixtures из `entities/pull-request`, без пагинации):
 * - GET /api/v1/reviews/:id           → ReviewDetail
 * - GET /api/v1/reviews/:id/findings  → FindingPage
 * - GET /api/v1/reviews/:id/diff      → Diff (404, пока diff не сохранён)
 * - GET /api/v1/repositories/:id/pull-requests → PullRequestPage
 */
export const reviewHandlers = [
  http.get(REVIEW_ROUTE, ({ cookies, params }) => {
    if (!isAuthenticated(cookies)) return new HttpResponse(null, { status: 401 })
    const fixture = MOCK_REVIEWS[String(params.id)]
    return fixture ? HttpResponse.json(fixture.review) : notFound()
  }),

  http.get(REVIEW_FINDINGS_ROUTE, ({ cookies, params }) => {
    if (!isAuthenticated(cookies)) return new HttpResponse(null, { status: 401 })
    const fixture = MOCK_REVIEWS[String(params.id)]
    return fixture ? HttpResponse.json({ items: fixture.findings, next_cursor: null }) : notFound()
  }),

  http.get(REVIEW_DIFF_ROUTE, ({ cookies, params }) => {
    if (!isAuthenticated(cookies)) return new HttpResponse(null, { status: 401 })
    const diff = MOCK_REVIEWS[String(params.id)]?.diff
    return diff ? HttpResponse.json(diff) : notFound()
  }),

  http.get(REPOSITORY_PULL_REQUESTS_ROUTE, ({ cookies, params }) => {
    if (!isAuthenticated(cookies)) return new HttpResponse(null, { status: 401 })
    if (!isKnownRepositoryId(String(params.id))) return notFound()
    return HttpResponse.json({ items: MSW_PULL_REQUESTS, next_cursor: null })
  }),

  http.post(REPOSITORY_PULL_REQUEST_REVIEWS_ROUTE, async ({ cookies, params, request }) => {
    if (!isAuthenticated(cookies)) return new HttpResponse(null, { status: 401 })
    if (!requireCsrf(request)) return new HttpResponse(null, { status: 403 })
    const idempotencyKey = request.headers.get('Idempotency-Key')
    const body = (await request.json().catch(() => null)) as { requested_head_sha?: unknown } | null
    const headSha = body?.requested_head_sha
    if (!idempotencyKey || typeof headSha !== 'string' || headSha === '') {
      return apiError(422, 'VALIDATION_FAILED', 'Idempotency-Key and requested_head_sha are required.')
    }
    if (!isKnownRepositoryId(String(params.id))) return notFound()
    const number = Number(params.number)
    if (!MSW_PULL_REQUESTS.some((pr) => pr.number === number)) return notFound()
    if (number === UNHEALTHY_PULL_REQUEST_NUMBER) {
      return apiError(409, 'INTEGRATION_UNHEALTHY', 'The GitHub integration is unhealthy. Try again later.')
    }
    const reviewId = REVIEW_ID_BY_PULL_REQUEST[number]
    if (!reviewId) return notFound()

    const replayKey = `${String(params.id)}|${number}|${idempotencyKey}`
    const replay = startReviewByKey.get(replayKey)
    if (replay && replay.headSha !== headSha) {
      return apiError(409, 'IDEMPOTENCY_CONFLICT', 'This Idempotency-Key was used with a different request.')
    }
    startReviewByKey.set(replayKey, { headSha })
    const resourceUrl = `/api/v1/reviews/${reviewId}`
    return HttpResponse.json(
      { review_id: reviewId, status: 'QUEUED', resource_url: resourceUrl },
      { status: replay ? 200 : 202, headers: { Location: resourceUrl } },
    )
  }),
]
