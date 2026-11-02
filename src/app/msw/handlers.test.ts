import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { reposHandlers, resetMswStartReviewState, reviewHandlers } from '@/app/msw/handlers'
import { resetRepositoryStore } from '@/app/msw/repos-store'
import { MSW_CSRF_TOKEN, clearSessionCookie, setSessionCookie } from '@/app/msw/session-cookie'
import {
  MOCK_DEFAULT_REVIEW_ID,
  MOCK_FETCHING_REVIEW_ID,
  MOCK_REPOSITORY_ID,
  MOCK_SKIPPED_REVIEW_ID,
} from '@/entities/pull-request'

const server = setupServer(...reposHandlers, ...reviewHandlers)

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetRepositoryStore()
  resetMswStartReviewState()
  setSessionCookie()
})
afterEach(() => {
  server.resetHandlers()
  clearSessionCookie()
})

const url = (path: string) => new URL(path, window.location.origin).toString()

function connect(externalId: string, csrf: string | null = MSW_CSRF_TOKEN) {
  return fetch(url('/api/v1/repositories/connect'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: JSON.stringify({ provider: 'github', external_id: externalId }),
  })
}

interface StartOptions {
  repositoryId?: string
  csrf?: string | null
  key?: string | null
  headSha?: string
}

let keySeq = 0
const freshKey = () => `key-${(keySeq += 1)}`

function startReview(number: number, options: StartOptions = {}) {
  const { repositoryId = MOCK_REPOSITORY_ID, csrf = MSW_CSRF_TOKEN, key = freshKey(), headSha = 'abc123' } = options
  return fetch(url(`/api/v1/repositories/${repositoryId}/pull-requests/${number}/reviews`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify({ requested_head_sha: headSha }),
  })
}

const listPullRequests = (repositoryId: string) => fetch(url(`/api/v1/repositories/${repositoryId}/pull-requests`))

describe('connect handler', () => {
  it('connects 1001 with 201', async () => {
    const response = await connect('1001')

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ id: 'connected-1001' })
  })

  it('answers 1002 once with 409 BOT_ACCESS_REQUIRED, then connects with 201', async () => {
    const first = await connect('1002')

    expect(first.status).toBe(409)
    const body = await first.json()
    expect(body).toMatchObject({
      code: 'BOT_ACCESS_REQUIRED',
      bot_login: 'dmc-bot-msw',
      access_url: 'https://github.com/acme/web-dashboard/settings/access',
      request_id: 'req_msw',
      retryable: false,
      retry_after: null,
    })
    expect(typeof body.message).toBe('string')
    expect(new URL(body.access_url).protocol).toBe('https:')

    const second = await connect('1002')
    expect(second.status).toBe(201)
    expect(await second.json()).toMatchObject({ id: 'connected-1002' })
  })

  it('answers 1003 with 503 SERVICE_UNAVAILABLE and no invite fields, every time', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await connect('1003')
      expect(response.status).toBe(503)
      const body = await response.json()
      expect(body).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
      expect(body).not.toHaveProperty('bot_login')
      expect(body).not.toHaveProperty('access_url')
    }
  })

  it('rejects a missing CSRF token with 403', async () => {
    expect((await connect('1001', null)).status).toBe(403)
  })
})

describe('pull request list handler', () => {
  it('serves the fixture list for MOCK_REPOSITORY_ID without connecting anything', async () => {
    const response = await listPullRequests(MOCK_REPOSITORY_ID)

    expect(response.status).toBe(200)
    const page = await response.json()
    expect(page.items.map((item: { number: number }) => item.number)).toEqual([42, 43, 44, 999])
  })

  it('includes an OPEN PR #999 for the unhealthy Start demo', async () => {
    const page = await (await listPullRequests(MOCK_REPOSITORY_ID)).json()

    expect(page.items.find((item: { number: number }) => item.number === 999)).toMatchObject({ state: 'OPEN' })
  })

  it('serves the list for a connected repo id other than MOCK_REPOSITORY_ID', async () => {
    await connect('1002')
    await connect('1002')

    const response = await listPullRequests('connected-1002')

    expect(response.status).toBe(200)
    expect((await response.json()).items.map((item: { number: number }) => item.number)).toContain(999)
  })

  it('answers 404 RESOURCE_NOT_FOUND for a repo that is not connected', async () => {
    const response = await listPullRequests('connected-1002')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'RESOURCE_NOT_FOUND' })
  })
})

describe('startReview handler', () => {
  it('rejects a missing session with 401', async () => {
    clearSessionCookie()

    expect((await startReview(42)).status).toBe(401)
  })

  it('rejects a missing CSRF token with 403', async () => {
    expect((await startReview(42, { csrf: null })).status).toBe(403)
  })

  it('rejects a missing Idempotency-Key with 422 VALIDATION_FAILED', async () => {
    const response = await startReview(42, { key: null })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('accepts #42 with 202, Location and the completed fixture review id', async () => {
    const response = await startReview(42)

    expect(response.status).toBe(202)
    const body = await response.json()
    expect(body).toEqual({
      review_id: MOCK_DEFAULT_REVIEW_ID,
      status: 'QUEUED',
      resource_url: `/api/v1/reviews/${MOCK_DEFAULT_REVIEW_ID}`,
    })
    expect(response.headers.get('Location')).toBe(`/api/v1/reviews/${MOCK_DEFAULT_REVIEW_ID}`)
  })

  it.each([
    [43, MOCK_SKIPPED_REVIEW_ID],
    [44, MOCK_FETCHING_REVIEW_ID],
  ])('maps #%i to its fixture review id', async (number, reviewId) => {
    const body = await (await startReview(number)).json()

    expect(body.review_id).toBe(reviewId)
  })

  it('answers #999 with 409 INTEGRATION_UNHEALTHY and no review id', async () => {
    const response = await startReview(999)

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body).toMatchObject({ code: 'INTEGRATION_UNHEALTHY' })
    expect(body).not.toHaveProperty('review_id')
  })

  it('answers an unknown PR number with 404', async () => {
    expect((await startReview(7)).status).toBe(404)
  })

  it('answers a repository that is not connected with 404', async () => {
    expect((await startReview(42, { repositoryId: 'connected-1002' })).status).toBe(404)
  })

  it('replays the same key and head sha with 200', async () => {
    const key = freshKey()
    await startReview(42, { key })

    const replay = await startReview(42, { key })

    expect(replay.status).toBe(200)
    expect((await replay.json()).review_id).toBe(MOCK_DEFAULT_REVIEW_ID)
  })

  it('does not replay across pull requests: the same key on another PR starts a new run', async () => {
    const key = freshKey()
    await startReview(42, { key })

    const other = await startReview(43, { key })

    expect(other.status).toBe(202)
    expect((await other.json()).review_id).toBe(MOCK_SKIPPED_REVIEW_ID)
  })

  it('does not replay across repositories: the same key on another repo starts a new run', async () => {
    await connect('1002')
    await connect('1002')
    const key = freshKey()
    await startReview(42, { key })

    const other = await startReview(42, { key, repositoryId: 'connected-1002' })

    expect(other.status).toBe(202)
  })

  it('forgets earlier keys after resetMswStartReviewState', async () => {
    const key = freshKey()
    await startReview(42, { key, headSha: 'abc123' })

    resetMswStartReviewState()

    expect((await startReview(42, { key, headSha: 'def456' })).status).toBe(202)
  })

  it('rejects the same key with a different head sha as 409 IDEMPOTENCY_CONFLICT', async () => {
    const key = freshKey()
    await startReview(42, { key, headSha: 'abc123' })

    const conflict = await startReview(42, { key, headSha: 'def456' })

    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('still loads the review after connecting only 1002 (fixtures stay on connected-1001)', async () => {
    await connect('1002')
    await connect('1002')

    const started = await startReview(42, { repositoryId: 'connected-1002' })
    expect(started.status).toBe(202)
    const { review_id: reviewId } = await started.json()

    const review = await fetch(url(`/api/v1/reviews/${reviewId}`))
    expect(review.status).toBe(200)
    expect((await review.json()).repository_id).toBe(MOCK_REPOSITORY_ID)
    expect((await listPullRequests(MOCK_REPOSITORY_ID)).status).toBe(200)
  })
})
