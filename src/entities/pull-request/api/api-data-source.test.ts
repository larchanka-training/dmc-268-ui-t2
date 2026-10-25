import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiPullRequestDataSource, ReviewNotFoundError } from '@/entities/pull-request'
import { MOCK_DEFAULT_REVIEW_ID, MOCK_PULL_REQUESTS, MOCK_REVIEWS } from '@/entities/pull-request/fixtures/reviews'

const fixture = MOCK_REVIEWS[MOCK_DEFAULT_REVIEW_ID]
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockFetch(handler: (url: URL) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => handler(new URL(String(input), 'http://x')))
}

afterEach(() => vi.restoreAllMocks())

describe('ApiPullRequestDataSource', () => {
  const ds = new ApiPullRequestDataSource()

  it('parses ReviewDetail and maps 404 to ReviewNotFoundError', async () => {
    mockFetch((url) =>
      url.pathname === `/api/v1/reviews/${MOCK_DEFAULT_REVIEW_ID}` ? json(fixture.review) : json({}, 404),
    )

    expect(await ds.getReview(MOCK_DEFAULT_REVIEW_ID)).toMatchObject({
      id: MOCK_DEFAULT_REVIEW_ID,
      pullRequestNumber: 42,
      status: 'COMPLETED',
      publicationStatus: 'PUBLISHED',
    })
    await expect(ds.getReview('missing')).rejects.toBeInstanceOf(ReviewNotFoundError)
  })

  it('collects findings across cursor pages', async () => {
    const [first, ...rest] = fixture.findings
    const fetchSpy = mockFetch((url) =>
      url.searchParams.get('cursor') === 'p2'
        ? json({ items: rest, next_cursor: null })
        : json({ items: [first], next_cursor: 'p2' }),
    )

    const comments = await ds.getReviewComments(MOCK_DEFAULT_REVIEW_ID)

    expect(comments.map((comment) => comment.id)).toEqual(fixture.findings.map((finding) => finding.id))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('returns null for a diff that is not stored yet (404) and parses a stored one', async () => {
    mockFetch(() => json({}, 404))
    expect(await ds.getDiff(MOCK_DEFAULT_REVIEW_ID)).toBeNull()

    vi.restoreAllMocks()
    mockFetch(() => json(fixture.diff))
    expect((await ds.getDiff(MOCK_DEFAULT_REVIEW_ID))?.map((file) => file.path)).toContain('src/api/user.ts')
  })

  it('finds the PR among open pull requests and stops paging once found', async () => {
    const fetchSpy = mockFetch((url) =>
      url.searchParams.get('cursor') === 'p2'
        ? json({ items: MOCK_PULL_REQUESTS.slice(1), next_cursor: 'p3' })
        : json({ items: MOCK_PULL_REQUESTS.slice(0, 1), next_cursor: 'p2' }),
    )

    expect(await ds.getPullRequest('repo', 43)).toMatchObject({ number: 43, sourceBranch: 'docs/refresh' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/v1/repositories/repo/pull-requests?limit=100')
  })

  it('returns null when the PR is not open anymore', async () => {
    mockFetch(() => json({ items: [], next_cursor: null }))

    expect(await ds.getPullRequest('repo', 42)).toBeNull()
  })
})
