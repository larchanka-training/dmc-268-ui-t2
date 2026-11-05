import { screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Review, ReviewStatus } from '@/entities/pull-request'
import { createFakeDataSource } from '@/test/fake-data-source'
import { TEST_PR, TEST_REVIEW, TEST_REVIEW_ID, TEST_REVIEW_PATH } from '@/test/fixtures'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => {
  vi.unstubAllGlobals()
})

const RUNNING: ReviewStatus[] = ['QUEUED', 'FETCHING_DIFF', 'PARSING_CONTEXT', 'LLM_PROCESSING']
const FINISHED: ReviewStatus[] = ['COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED']

function renderStatus(status: ReviewStatus) {
  const running = RUNNING.includes(status)
  const getReview = vi.fn(async () => ({
    ...TEST_REVIEW,
    status,
    publicationStatus: 'NOT_READY' as const,
    finishedAt: running ? null : TEST_REVIEW.finishedAt,
    error: null,
  }))
  const view = renderWithRouter(TEST_REVIEW_PATH, {
    dataSource: createFakeDataSource({ getReview }),
  })
  return { ...view, getReview }
}

it('shows Stop only while a review is still running and posts cancellation', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      return Response.json({ review_id: TEST_REVIEW_ID, status: 'FAILED', reason_code: 'USER_CANCELLED' })
    }),
  )

  for (const status of FINISHED) {
    const view = renderStatus(status)
    expect(await screen.findByRole('region', { name: 'Статус проверки' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
    view.unmount()
  }

  for (const status of RUNNING) {
    if (status === 'QUEUED') continue
    const view = renderStatus(status)
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    view.unmount()
  }

  const { user, getReview } = renderStatus('QUEUED')
  const before = getReview.mock.calls.length
  await user.click(await screen.findByRole('button', { name: 'Stop' }))

  await waitFor(() => expect(getReview.mock.calls.length).toBeGreaterThan(before))
  const cancel = calls.find((call) => call.url.endsWith('/cancellation'))
  expect(cancel?.url).toBe(`/api/v1/reviews/${TEST_REVIEW_ID}/cancellation`)
  expect(cancel?.init.method).toBe('POST')
  expect(cancel?.init.credentials).toBe('include')
  expect(cancel?.init.body ?? '').toBe('')
  const headers = cancel?.init.headers as Record<string, string>
  expect(headers['X-CSRF-Token']).toBe('csrf')
  expect(headers['Idempotency-Key']).toMatch(/\S+/)
}, 20_000)

function renderReview(review: Partial<Review>, getPullRequest?: () => Promise<typeof TEST_PR | null>) {
  return renderWithRouter(TEST_REVIEW_PATH, {
    dataSource: createFakeDataSource({
      getReview: async () => ({ ...TEST_REVIEW, ...review }),
      ...(getPullRequest ? { getPullRequest } : {}),
    }),
  })
}

it('shows Run again only for a settled review of an open pull request and sends rerun_of', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      return Response.json({ review_id: 'rev-new', status: 'QUEUED' }, { status: 202 })
    }),
  )

  const running = renderReview({ status: 'QUEUED', publicationStatus: 'NOT_READY', finishedAt: null })
  expect(await screen.findByRole('region', { name: 'Статус проверки' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Run again' })).not.toBeInTheDocument()
  running.unmount()

  const publishing = renderReview({
    status: 'COMPLETED',
    publicationStatus: 'PENDING',
    finishedAt: TEST_REVIEW.finishedAt,
  })
  expect(await screen.findByRole('region', { name: 'Статус проверки' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Run again' })).not.toBeInTheDocument()
  publishing.unmount()

  const missing = renderReview({ status: 'FAILED', publicationStatus: 'NOT_READY' }, async () => null)
  expect(await screen.findByRole('region', { name: 'Статус проверки' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Run again' })).not.toBeInTheDocument()
  missing.unmount()

  const failedQuery = renderReview({ status: 'FAILED', publicationStatus: 'NOT_READY' }, async () => {
    throw new Error('github down')
  })
  expect(await screen.findByRole('region', { name: 'Статус проверки' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Run again' })).not.toBeInTheDocument()
  failedQuery.unmount()

  const { user, router } = renderReview({ status: 'FAILED', publicationStatus: 'NOT_READY' })
  await user.click(await screen.findByRole('button', { name: 'Run again' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/reviews/rev-new'))
  const start = calls.find((call) => call.url.endsWith('/pull-requests/42/reviews'))
  expect(start?.url).toBe('/api/v1/repositories/repo-1/pull-requests/42/reviews')
  expect(start?.init.method).toBe('POST')
  expect(start?.init.credentials).toBe('include')
  const headers = start?.init.headers as Record<string, string>
  expect(headers['X-CSRF-Token']).toBe('csrf')
  expect(headers['Idempotency-Key']).toMatch(/\S+/)
  expect(JSON.parse(String(start?.init.body))).toEqual({
    requested_head_sha: TEST_PR.headSha,
    rerun_of: TEST_REVIEW_ID,
  })
})

it('uses a new Idempotency-Key when Run again targets a different review', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init: init ?? {} })
      const starts = calls.filter((call) => call.url.endsWith('/pull-requests/42/reviews'))
      if (starts.length === 1) return new Response(null, { status: 503 })
      return Response.json({ review_id: 'rev-new', status: 'QUEUED' }, { status: 202 })
    }),
  )

  const { user, router } = renderWithRouter('/reviews/rev-a', {
    dataSource: createFakeDataSource({
      getReview: async (id) => ({ ...TEST_REVIEW, id, status: 'FAILED', publicationStatus: 'NOT_READY' }),
      getDiff: async () => [],
      getReviewComments: async () => [],
    }),
  })

  const runAgain = () => screen.findByRole('button', { name: 'Run again' })
  await user.click(await runAgain())
  await waitFor(() => expect(calls.filter((call) => call.url.endsWith('/reviews'))).toHaveLength(1))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Run again' })).toBeEnabled())

  await router.navigate('/reviews/rev-b')
  await waitFor(() => expect(router.state.location.pathname).toBe('/reviews/rev-b'))
  const second = await runAgain()
  expect(second).toBeEnabled()
  await user.click(second)
  await waitFor(() => expect(calls.filter((call) => call.url.endsWith('/reviews'))).toHaveLength(2))

  const starts = calls.filter((call) => call.url.endsWith('/pull-requests/42/reviews'))
  const key = (call: { init: RequestInit }) => (call.init.headers as Record<string, string>)['Idempotency-Key']
  expect(JSON.parse(String(starts[0]?.init.body)).rerun_of).toBe('rev-a')
  expect(JSON.parse(String(starts[1]?.init.body)).rerun_of).toBe('rev-b')
  expect(key(starts[0])).toMatch(/\S+/)
  expect(key(starts[1])).not.toBe(key(starts[0]))
})
