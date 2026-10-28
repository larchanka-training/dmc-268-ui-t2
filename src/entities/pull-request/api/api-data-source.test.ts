import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiPullRequestDataSource,
  MOCK_DEFAULT_REVIEW_ID,
  MOCK_PULL_REQUESTS,
  MOCK_REPOSITORY_ID,
  MOCK_REVIEWS,
  ReviewNotFoundError,
} from '@/entities/pull-request'
import type { PullRequestWire, ReviewDetailWire } from '@/entities/pull-request/model/types'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function completedReviewWire(id: string): ReviewDetailWire {
  return {
    id,
    repository_id: 'repo-1',
    pull_request_number: 42,
    status: 'COMPLETED',
    requested_head_sha: 'abc1234',
    snapshot: null,
    progress: { completed_chunks: 2, planned_chunks: 2 },
    summary: 'Looks good',
    coverage: null,
    usage: null,
    publication_status: 'PUBLISHED',
    created_at: '2026-10-01T10:00:00Z',
    started_at: '2026-10-01T10:01:00Z',
    finished_at: '2026-10-01T10:05:00Z',
    retry_at: null,
    error: null,
  }
}

describe('ApiPullRequestDataSource', () => {
  const ds = new ApiPullRequestDataSource()

  it('getReview fetches with credentials and returns the parsed review', async () => {
    const wire = completedReviewWire('rev-1')
    const fetchMock = vi.fn(async () => Response.json(wire))
    vi.stubGlobal('fetch', fetchMock)

    const review = await ds.getReview('rev-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/reviews/rev-1', expect.objectContaining({ credentials: 'include' }))
    expect(review).toEqual({
      id: 'rev-1',
      repositoryId: 'repo-1',
      pullRequestNumber: 42,
      status: 'COMPLETED',
      publicationStatus: 'PUBLISHED',
      requestedHeadSha: 'abc1234',
      summary: 'Looks good',
      progress: { completedChunks: 2, plannedChunks: 2 },
      createdAt: '2026-10-01T10:00:00Z',
      startedAt: '2026-10-01T10:01:00Z',
      finishedAt: '2026-10-01T10:05:00Z',
      error: null,
    })
  })

  it('getReview rejects with ReviewNotFoundError on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    )

    await expect(ds.getReview('missing')).rejects.toThrow(new ReviewNotFoundError('missing'))
  })

  it('getDiff returns null on 404', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(ds.getDiff('rev-1')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/reviews/rev-1/diff',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('getDiff returns null on 410 so findings can still load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 410 })),
    )

    await expect(ds.getDiff('rev-1')).resolves.toBeNull()
  })

  it('getDiff fetches with credentials and returns parsed files', async () => {
    const wire = {
      files: [
        {
          path: 'src/a.ts',
          previous_path: null,
          status: 'modified' as const,
          hunks: [
            {
              old_start: 1,
              old_lines: 1,
              new_start: 1,
              new_lines: 1,
              lines: [{ kind: 'added' as const, content: 'x', old_line: null, new_line: 1 }],
            },
          ],
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(wire)),
    )

    const files = await ds.getDiff('rev-1')

    expect(files).toHaveLength(1)
    expect(files![0]).toMatchObject({
      path: 'src/a.ts',
      status: 'modified',
      additions: 1,
      deletions: 0,
    })
  })

  it('getReviewComments follows next_cursor until null', async () => {
    const finding = (id: string) => ({
      id,
      fingerprint: id,
      path: 'a.ts',
      side: 'NEW' as const,
      start_line: 1,
      end_line: 1,
      category: 'correctness' as const,
      severity: 'low' as const,
      title: id,
      explanation: '',
      evidence: '',
      recommendation: '',
      proposed_diff_fix: null,
      publication_reference: null,
    })
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input))
        if (calls.length === 1) {
          return Response.json({ items: [finding('f1')], next_cursor: 'page+2=' })
        }
        return Response.json({ items: [finding('f2')], next_cursor: null })
      }),
    )

    const comments = await ds.getReviewComments('rev-1')

    expect(comments.map((c) => c.id)).toEqual(['f1', 'f2'])
    expect(calls).toEqual([
      '/api/v1/reviews/rev-1/findings?limit=20',
      '/api/v1/reviews/rev-1/findings?limit=20&cursor=page%2B2%3D',
    ])
  })

  it('getPullRequest walks pages until the number is found', async () => {
    const pr = (number: number): PullRequestWire => ({
      number,
      title: `PR ${number}`,
      author: { login: 'octocat' },
      state: 'OPEN',
      source: { repository_external_id: '1', ref: 'feature', sha: 'deadbeef' },
      base: { repository_external_id: '1', ref: 'main', sha: 'cafebabe' },
    })
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input))
        if (calls.length === 1) {
          return Response.json({ items: [pr(1)], next_cursor: 'more' })
        }
        return Response.json({ items: [pr(42)], next_cursor: null })
      }),
    )

    const found = await ds.getPullRequest('repo-1', 42)

    expect(found).toEqual({
      number: 42,
      title: 'PR 42',
      author: { login: 'octocat' },
      sourceBranch: 'feature',
      targetBranch: 'main',
      headSha: 'deadbeef',
    })
    expect(calls).toEqual([
      '/api/v1/repositories/repo-1/pull-requests?limit=20',
      '/api/v1/repositories/repo-1/pull-requests?limit=20&cursor=more',
    ])
  })

  it('loads the default MSW fixture through the four GETs', async () => {
    const fixture = MOCK_REVIEWS[MOCK_DEFAULT_REVIEW_ID]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === `/api/v1/reviews/${MOCK_DEFAULT_REVIEW_ID}`) {
          return Response.json(fixture.review)
        }
        if (url.startsWith(`/api/v1/reviews/${MOCK_DEFAULT_REVIEW_ID}/findings`)) {
          return Response.json({ items: fixture.findings, next_cursor: null })
        }
        if (url === `/api/v1/reviews/${MOCK_DEFAULT_REVIEW_ID}/diff`) {
          return Response.json(fixture.diff)
        }
        if (url.startsWith(`/api/v1/repositories/${MOCK_REPOSITORY_ID}/pull-requests`)) {
          return Response.json({ items: MOCK_PULL_REQUESTS, next_cursor: null })
        }
        return new Response(null, { status: 500 })
      }),
    )

    const review = await ds.getReview(MOCK_DEFAULT_REVIEW_ID)
    const comments = await ds.getReviewComments(MOCK_DEFAULT_REVIEW_ID)
    const files = await ds.getDiff(MOCK_DEFAULT_REVIEW_ID)
    const pr = await ds.getPullRequest(review.repositoryId, review.pullRequestNumber)

    expect(review.id).toBe(MOCK_DEFAULT_REVIEW_ID)
    expect(review.status).toBe('COMPLETED')
    expect(comments.length).toBe(fixture.findings.length)
    expect(files?.length).toBe(fixture.diff!.files.length)
    expect(pr?.number).toBe(review.pullRequestNumber)
    expect(pr?.title).toBeTruthy()
  })

  it('getPullRequest returns null when the number is not on any page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          items: [
            {
              number: 1,
              title: 'other',
              author: { login: 'a' },
              state: 'OPEN' as const,
              source: { repository_external_id: '1', ref: 'a', sha: '1' },
              base: { repository_external_id: '1', ref: 'main', sha: '2' },
            },
          ],
          next_cursor: null,
        }),
      ),
    )

    await expect(ds.getPullRequest('repo-1', 99)).resolves.toBeNull()
  })
})
