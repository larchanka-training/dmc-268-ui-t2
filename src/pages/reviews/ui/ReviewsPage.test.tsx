import { QueryClient } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { type AuditReview } from '@/entities/repository-insights'
import { fakeMe, renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

const repo = {
  id: 'repo-1',
  provider: 'github',
  external_id: '1001',
  owner: 'octocat',
  name: 'hello',
  role: 'reviewer',
  capabilities: { can_start_review: true, can_manage_settings: false },
}

const createdAt = '2026-10-30T23:30:00.000Z'

function reviewRow(id = 'review-1'): AuditReview {
  return {
    id,
    pull_request_number: 42,
    requested_head_sha: 'a'.repeat(40),
    status: 'PARTIAL',
    publication_status: 'PENDING',
    created_at: createdAt,
    started_at: null,
    finished_at: null,
    trigger_type: 'manual',
    actor: { id: 'user-1', login: 'ada' },
    usage: {
      input_tokens: 120,
      output_tokens: 0,
      reserved_input_tokens: 1000,
      reserved_output_tokens: 200,
      status: 'incomplete',
    },
    limit_reasons: ['token_budget'],
    cost: { amount: null, currency: null, status: 'unavailable' },
  }
}

function stubFinder(reviews = [reviewRow()]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/reviews')) {
        return Response.json({ items: reviews, next_cursor: null })
      }
      return Response.json({ items: [repo], next_cursor: null })
    }),
  )
}

test('a review run row shows the finder fields and opens our review page', async () => {
  stubFinder()
  const { user, router } = renderWithRouter('/reviews')

  const rowLink = await screen.findByRole('link', { name: /octocat\/hello/ })
  expect(rowLink).toHaveAttribute('href', '/reviews/review-1')
  expect(rowLink).toHaveTextContent('#42')
  expect(rowLink).toHaveTextContent('aaaaaaa')
  expect(rowLink).not.toHaveTextContent('a'.repeat(8))
  expect(rowLink).toHaveTextContent('Ревью частичное')
  expect(rowLink).toHaveTextContent('Публикуется')
  expect(rowLink).toHaveTextContent('ada')
  expect(rowLink).not.toHaveTextContent('manual')
  expect(rowLink).not.toHaveTextContent('120')
  expect(rowLink).not.toHaveTextContent('token_budget')

  const created = new Date(createdAt)
  const time = screen.getByRole('time')
  const hour12 = created.getHours() % 12 || 12
  expect(time).toHaveAttribute('dateTime', createdAt)
  expect(time.textContent).toContain(String(created.getDate()))
  expect(time.textContent).toMatch(new RegExp(`(?:^|\\D)0?(?:${created.getHours()}|${hour12}):`))
  expect(time.textContent).toContain(String(created.getMinutes()).padStart(2, '0'))

  await user.click(rowLink)
  expect(router.state.location.pathname).toBe('/reviews/review-1')
})

test('the GitHub control opens the pull request in a new tab and stays on the list', async () => {
  stubFinder()
  const { user, router } = renderWithRouter('/reviews')

  const github = await screen.findByRole('link', { name: 'GitHub pull request' })
  expect(github).toHaveAttribute('href', 'https://github.com/octocat/hello/pull/42')
  expect(github).toHaveAttribute('target', '_blank')
  expect(github).toHaveAttribute('rel', expect.stringContaining('noopener'))

  await user.click(github)
  expect(router.state.location.pathname).toBe('/reviews')
})

test('runs from every repository are newest first', async () => {
  const olderRepo = { ...repo, id: 'repo-a', name: 'alpha' }
  const newerRepo = { ...repo, id: 'repo-b', name: 'beta' }
  const older = { ...reviewRow('older'), pull_request_number: 1, created_at: '2026-10-01T00:00:00.000Z' }
  const newer = { ...reviewRow('newer'), pull_request_number: 2, created_at: '2026-10-20T00:00:00.000Z' }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/repo-a/reviews')) return Response.json({ items: [older], next_cursor: null })
      if (url.includes('/repo-b/reviews')) return Response.json({ items: [newer], next_cursor: null })
      return Response.json({ items: [olderRepo, newerRepo], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  const rows = await screen.findAllByRole('link', { name: /octocat\// })
  expect(rows.map((link) => link.getAttribute('href'))).toEqual(['/reviews/newer', '/reviews/older'])
})

test('runs with the same time are ordered by id descending', async () => {
  const firstRepo = { ...repo, id: 'repo-a', name: 'alpha' }
  const secondRepo = { ...repo, id: 'repo-b', name: 'beta' }
  const lowId = { ...reviewRow('m-a'), pull_request_number: 1 }
  const highId = { ...reviewRow('m-b'), pull_request_number: 2 }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/repo-a/reviews')) return Response.json({ items: [lowId], next_cursor: null })
      if (url.includes('/repo-b/reviews')) return Response.json({ items: [highId], next_cursor: null })
      return Response.json({ items: [firstRepo, secondRepo], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  const rows = await screen.findAllByRole('link', { name: /octocat\// })
  expect(rows.map((link) => link.getAttribute('href'))).toEqual(['/reviews/m-b', '/reviews/m-a'])
})

test('a repeated next cursor lists both pages and is not fetched again', async () => {
  const second = { ...reviewRow('page-2'), pull_request_number: 7 }
  const reviewCalls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (!url.includes('/reviews')) return Response.json({ items: [repo], next_cursor: null })
      reviewCalls.push(url)
      // A third page fetch must not spin until the heap dies; the assertion below still sees it.
      if (reviewCalls.length > 2) return new Promise<Response>(() => {})
      if (url.includes('cursor=again')) return Response.json({ items: [second], next_cursor: 'again' })
      return Response.json({ items: [reviewRow()], next_cursor: 'again' })
    }),
  )

  renderWithRouter('/reviews')

  await expect.poll(() => reviewCalls.length).toBe(2)
  expect(await screen.findByRole('link', { name: /#42/ })).toHaveAttribute('href', '/reviews/review-1')
  expect(screen.getByRole('link', { name: /#7/ })).toHaveAttribute('href', '/reviews/page-2')
})

test('a later page in the 30-day window is still listed', async () => {
  const second = { ...reviewRow('page-2'), pull_request_number: 7 }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/reviews') && url.includes('cursor=more')) {
        return Response.json({ items: [second], next_cursor: null })
      }
      if (url.includes('/reviews')) return Response.json({ items: [reviewRow()], next_cursor: 'more' })
      return Response.json({ items: [repo], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByRole('link', { name: /#7/ })).toHaveAttribute('href', '/reviews/page-2')
})

test('shows one loading line and no rows until every repository history has settled', async () => {
  let releaseReviews: () => void = () => {}
  const reviewsGate = new Promise<void>((resolve) => {
    releaseReviews = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/reviews')) {
        await reviewsGate
        return Response.json({ items: [reviewRow()], next_cursor: null })
      }
      return Response.json({ items: [repo], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByText('Loading reviews…')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /octocat\/hello/ })).not.toBeInTheDocument()

  releaseReviews()
  expect(await screen.findByRole('link', { name: /octocat\/hello/ })).toBeInTheDocument()
})

test('no connected repositories links to connect one', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ items: [], next_cursor: null })),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByText('No repositories connected yet.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Connect repository' })).toHaveAttribute('href', '/repos/connect')
  expect(screen.queryByText('No reviews in the last 30 days.')).not.toBeInTheDocument()
})

test('no runs in the window links back to repositories', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/reviews')) return Response.json({ items: [], next_cursor: null })
      return Response.json({ items: [repo], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByText('No reviews in the last 30 days.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Repositories' })).toHaveAttribute('href', '/repos')
  expect(screen.queryByText('No repositories connected yet.')).not.toBeInTheDocument()
})

test('every repository history failing is one error, not an empty list', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/reviews')) return new Response(null, { status: 500 })
      return Response.json({ items: [repo], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load reviews.')
  expect(screen.queryByText('No reviews in the last 30 days.')).not.toBeInTheDocument()
})

test('a failed connected-repository request is one error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 500 })),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByRole('alert', undefined, { timeout: 3000 })).toHaveTextContent('Could not load reviews.')
  expect(screen.queryByText('No repositories connected yet.')).not.toBeInTheDocument()
})

test('failed histories with no successful runs name each failure and omit the empty window', async () => {
  const emptyRepo = { ...repo, id: 'repo-empty', name: 'empty' }
  const failedRepo = { ...repo, id: 'repo-bad', name: 'broken' }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/repo-bad/reviews')) return new Response(null, { status: 500 })
      if (url.includes('/reviews')) return Response.json({ items: [], next_cursor: null })
      return Response.json({ items: [emptyRepo, failedRepo], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load reviews for octocat/broken.')
  expect(screen.queryByText('No reviews in the last 30 days.')).not.toBeInTheDocument()
})

test('one failed repository is named and the loaded runs stay', async () => {
  const ok = { ...repo, id: 'repo-ok', name: 'hello' }
  const bad = { ...repo, id: 'repo-bad', name: 'broken' }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/repo-bad/reviews')) return new Response(null, { status: 500 })
      if (url.includes('/reviews')) return Response.json({ items: [reviewRow()], next_cursor: null })
      return Response.json({ items: [ok, bad], next_cursor: null })
    }),
  )

  renderWithRouter('/reviews')

  expect(await screen.findByRole('link', { name: /octocat\/hello/ })).toHaveAttribute('href', '/reviews/review-1')
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load reviews for octocat/broken.')
})

test('a run with no person reads Unknown actor', async () => {
  stubFinder([{ ...reviewRow(), actor: null }])

  renderWithRouter('/reviews')

  expect(await screen.findByRole('link', { name: /octocat\/hello/ })).toHaveTextContent('Unknown actor')
})

test('a 401 from review history clears the session and returns to login', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/me')) return new Response(null, { status: 401 })
      if (url.includes('/reviews')) return new Response(null, { status: 401 })
      return Response.json({ items: [repo], next_cursor: null })
    }),
  )

  const { router } = renderWithRouter('/reviews')

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
  expect(screen.queryByText('Could not load reviews.')).not.toBeInTheDocument()
})

test('the next signed-in user does not see the previous review rows while their history is loading', async () => {
  let secondUser = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/reviews')) {
        if (secondUser) return new Promise<Response>(() => {})
        return Response.json({ items: [reviewRow()], next_cursor: null })
      }
      return Response.json({ items: [repo], next_cursor: null })
    }),
  )

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  })
  const first = renderWithRouter('/reviews', { queryClient })
  expect(await screen.findByRole('link', { name: /octocat\/hello/ })).toHaveTextContent('#42')

  first.unmount()
  secondUser = true
  renderWithRouter('/reviews', {
    queryClient,
    session: { ...fakeMe, user: { ...fakeMe.user, id: 'user-2', login: 'grace' } },
  })

  expect(await screen.findByText('Loading reviews…')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /octocat\/hello/ })).not.toBeInTheDocument()
  expect(screen.queryByText('#42')).not.toBeInTheDocument()
})
