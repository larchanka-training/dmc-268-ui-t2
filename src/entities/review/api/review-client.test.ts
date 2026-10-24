import { afterEach, expect, test, vi } from 'vitest'
import { fetchReview } from '@/entities/review'
import { ApiHttpError } from '@/shared/api/http'

afterEach(() => {
  vi.unstubAllGlobals()
})

function reviewDetailWire() {
  return {
    id: 'rev-1',
    repository_id: 'repo-1',
    pull_request_number: 42,
    status: 'LLM_PROCESSING',
    requested_head_sha: 'abc123',
    snapshot: null,
    progress: { completed_chunks: 1, planned_chunks: 3 },
    summary: null,
    coverage: null,
    usage: null,
    publication_status: 'NOT_READY',
    created_at: '2026-10-24T08:00:00Z',
    started_at: '2026-10-24T08:00:02Z',
    finished_at: null,
    retry_at: null,
    error: null,
  }
}

test('fetchReview reads review detail into the UI shape', async () => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Response.json(reviewDetailWire())
    }),
  )

  const review = await fetchReview('rev-1')

  expect(calls).toEqual(['/api/v1/reviews/rev-1'])
  expect(review).toEqual({
    id: 'rev-1',
    pullRequestNumber: 42,
    status: 'LLM_PROCESSING',
    publicationStatus: 'NOT_READY',
    progress: { completedChunks: 1, plannedChunks: 3 },
    summary: null,
  })
})

test('fetchReview surfaces HTTP failures with their status', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 })),
  )

  const error = await fetchReview('missing').catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(ApiHttpError)
  expect((error as ApiHttpError).status).toBe(404)
})
