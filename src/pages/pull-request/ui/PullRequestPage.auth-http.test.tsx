import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  ApiPullRequestDataSource,
  MOCK_DEFAULT_REVIEW_ID,
  MOCK_PULL_REQUESTS,
  MOCK_REVIEWS,
  useReviewQuery,
} from '@/entities/pull-request'
import { appRoutes } from '@/app/routes'
import { reviewQueryKey } from '@/entities/pull-request/api/queries'
import { meQueryKey } from '@/entities/session'
import { fakeMe, renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

const reviewId = MOCK_DEFAULT_REVIEW_ID
const fixture = MOCK_REVIEWS[reviewId]
const path = `/reviews/${reviewId}?view=split`

function successfulRead(input: RequestInfo | URL): Response {
  const url = String(input)
  if (url.endsWith('/diff')) return Response.json(fixture.diff)
  if (url.includes('/findings?')) return Response.json({ items: fixture.findings, next_cursor: null })
  if (url.includes('/pull-requests?')) return Response.json({ items: MOCK_PULL_REQUESTS, next_cursor: null })
  return Response.json({ ...fixture.review, summary: 'Private review summary.' })
}

// Compatibility characterization: masked404 already hides cached private content without logging out.
test('a masked review404 after a successful read hides private content and preserves the valid session', async () => {
  let masked = false
  let meReads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/me') {
        meReads += 1
        throw new Error('404 must not recheck authentication')
      }
      if (masked && url === `/api/v1/reviews/${reviewId}`) return new Response(null, { status: 404 })
      return successfulRead(input)
    }),
  )
  const { router, queryClient } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await screen.findByText('Private review summary.')
  expect(screen.getAllByTestId('comment-card').length).toBeGreaterThan(0)
  masked = true
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: reviewQueryKey(reviewId, fakeMe.user.id), exact: true })
  })
  await screen.findByTestId('review-not-found')
  expect(screen.queryByText('Private review summary.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/reviews/${reviewId}`)
  expect(meReads).toBe(0)
})

test('a review401 rechecks cached session and sends the actual review route to login with its return URL', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === `/api/v1/reviews/${reviewId}` || url === '/api/v1/me') return new Response(null, { status: 401 })
      return successfulRead(input)
    }),
  )
  const { router } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(path)
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  expect(screen.queryByText('Private review summary.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument()
})

test('a diff-only401 cannot be masked by successful review and findings reads', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return url.endsWith('/diff') || url === '/api/v1/me' ? new Response(null, { status: 401 }) : successfulRead(input)
    }),
  )
  const { router } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(path)
  expect(screen.queryByText('Private review summary.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument()
})

test('a later findings-page401 rechecks the session instead of exposing partial private findings', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/me') return new Response(null, { status: 401 })
      if (url.includes('/findings?')) {
        if (new URL(url, 'http://test').searchParams.has('cursor')) return new Response(null, { status: 401 })
        return Response.json({ items: fixture.findings.slice(0, 1), next_cursor: 'second+page=' })
      }
      return successfulRead(input)
    }),
  )
  const { router } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(path)
  expect(screen.queryByText('Private review summary.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument()
})

test('an optional PR metadata401 still rechecks authentication when the saved review reads succeed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return url.includes('/pull-requests?') || url === '/api/v1/me'
        ? new Response(null, { status: 401 })
        : successfulRead(input)
    }),
  )
  const { router } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(path)
  expect(screen.queryByText('Private review summary.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument()
})

function ExportedDetailReader() {
  const query = useReviewQuery(reviewId)
  return <p>{query.data?.summary ?? 'Reading detail…'}</p>
}

test('the exported detail hook rechecks review401 under the existing authenticated route shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 401 })),
  )
  const routes = appRoutes.map((route) =>
    !route.children
      ? route
      : {
          ...route,
          children: route.children.map((child) =>
            child.path === '/reviews/:reviewId' ? { ...child, element: <ExportedDetailReader /> } : child,
          ),
        },
  )
  const { router } = renderWithRouter(path, { routes, dataSource: new ApiPullRequestDataSource() })
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(path)
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
})

test('a late review401 from the old actor cannot reset the newer valid session and collapse its private view', async () => {
  let actor = 'A'
  let completeOld!: (response: Response) => void
  let completeMe: ((response: Response) => void) | undefined
  let meReads = 0
  const meB = {
    user: { id: 'user-2', provider: 'github', external_id: '2', login: 'grace' },
    session: { expires_at: '2999-01-01T00:00:00Z' },
    csrf_token: 'csrf-B',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/me') {
        meReads += 1
        if (meReads > 1)
          return new Promise<Response>((resolve) => {
            completeMe = resolve
          })
        return Response.json(meB)
      }
      if (url === `/api/v1/reviews/${reviewId}`) {
        if (actor === 'A')
          return new Promise<Response>((resolve) => {
            completeOld = resolve
          })
        return Response.json({ ...fixture.review, summary: 'Private view for B.' })
      }
      return successfulRead(input)
    }),
  )
  const { user, queryClient } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await waitFor(() => expect(completeOld).toBeTypeOf('function'))
  actor = 'B'
  await act(async () => {
    await queryClient.resetQueries({ queryKey: meQueryKey })
  })
  await screen.findByText('Private view for B.')
  const firstCard = screen.getAllByTestId('comment-card')[0]
  await user.click(within(firstCard).getByRole('button', { expanded: false }))
  await act(async () => {
    completeOld(new Response(null, { status: 401 }))
  })
  if (completeMe) {
    await screen.findByText('Loading session…')
    await act(async () => {
      completeMe!(Response.json(meB))
    })
  }
  await screen.findByText('Private view for B.')
  expect(within(screen.getAllByTestId('comment-card')[0]).getByRole('button', { expanded: true })).toBeInTheDocument()
  expect(meReads).toBe(1)
})

test('a late401 from an abandoned review cannot reset the same actor while another review is open', async () => {
  const nextReview = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  let completeOld!: (response: Response) => void
  let completeMe: ((response: Response) => void) | undefined
  const meA = {
    user: { id: 'user-1', provider: 'github', external_id: '1', login: 'ada' },
    session: { expires_at: '2999-01-01T00:00:00Z' },
    csrf_token: 'csrf',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === `/api/v1/reviews/${reviewId}`)
        return new Promise<Response>((resolve) => {
          completeOld = resolve
        })
      if (url === '/api/v1/me')
        return new Promise<Response>((resolve) => {
          completeMe = resolve
        })
      if (url === `/api/v1/reviews/${nextReview}`)
        return Response.json({ ...fixture.review, id: nextReview, summary: 'Private current review.' })
      return successfulRead(input)
    }),
  )
  const { user, router } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await waitFor(() => expect(completeOld).toBeTypeOf('function'))
  await act(async () => {
    await router.navigate(`/reviews/${nextReview}?view=split`)
  })
  await screen.findByText('Private current review.')
  await user.click(within(screen.getAllByTestId('comment-card')[0]).getByRole('button', { expanded: false }))
  await act(async () => {
    completeOld(new Response(null, { status: 401 }))
  })
  if (completeMe) {
    await screen.findByText('Loading session…')
    await act(async () => {
      completeMe!(Response.json(meA))
    })
  }
  await screen.findByText('Private current review.')
  expect(within(screen.getAllByTestId('comment-card')[0]).getByRole('button', { expanded: true })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/reviews/${nextReview}`)
})

test('a Start401 rechecks authentication without retrying or creating a second Start attempt', async () => {
  const entry = `/repos/${fixture.review.repository_id}/pull-requests?from=review`
  let writes = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        writes += 1
        return new Response(null, { status: 401 })
      }
      return String(input) === '/api/v1/me' ? new Response(null, { status: 401 }) : successfulRead(input)
    }),
  )
  const { user, router } = renderWithRouter(entry, { dataSource: new ApiPullRequestDataSource() })
  await user.click((await screen.findAllByRole('button', { name: 'Start review' }))[0])
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(entry)
  expect(writes).toBe(1)
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
})

test('a late Start401 from an unmounted button cannot reset the valid current review view', async () => {
  let completeStart!: (response: Response) => void
  let completeMe: ((response: Response) => void) | undefined
  const meA = {
    user: { id: 'user-1', provider: 'github', external_id: '1', login: 'ada' },
    session: { expires_at: '2999-01-01T00:00:00Z' },
    csrf_token: 'csrf',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST')
        return new Promise<Response>((resolve) => {
          completeStart = resolve
        })
      if (String(input) === '/api/v1/me')
        return new Promise<Response>((resolve) => {
          completeMe = resolve
        })
      return successfulRead(input)
    }),
  )
  const { user, router, queryClient } = renderWithRouter(`/repos/${fixture.review.repository_id}/pull-requests`, {
    dataSource: new ApiPullRequestDataSource(),
  })
  await user.click((await screen.findAllByRole('button', { name: 'Start review' }))[0])
  await act(async () => {
    await router.navigate(path)
  })
  await screen.findByText('Private review summary.')
  await user.click(within(screen.getAllByTestId('comment-card')[0]).getByRole('button', { expanded: false }))
  await act(async () => {
    completeStart(new Response(null, { status: 401 }))
  })
  if (completeMe) {
    await screen.findByText('Loading session…')
    await act(async () => {
      completeMe!(Response.json(meA))
    })
  }
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  await screen.findByText('Private review summary.')
  expect(within(screen.getAllByTestId('comment-card')[0]).getByRole('button', { expanded: true })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/reviews/${reviewId}`)
})

test('a Start401 from an old actor cannot reset a new valid actor when its cached PR row keeps the button mounted', async () => {
  let actor = 'B'
  let meReads = 0
  let completeStart!: (response: Response) => void
  let completeMe: ((response: Response) => void) | undefined
  const meWire = (value: string) => ({
    user: {
      id: value === 'A' ? 'user-1' : 'user-2',
      provider: 'github',
      external_id: value,
      login: value === 'A' ? 'ada' : 'grace',
    },
    session: { expires_at: '2999-01-01T00:00:00Z' },
    csrf_token: 'csrf-' + value,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST')
        return new Promise<Response>((resolve) => {
          completeStart = resolve
        })
      if (String(input) === '/api/v1/me') {
        meReads += 1
        if (meReads > 2)
          return new Promise<Response>((resolve) => {
            completeMe = resolve
          })
        return Response.json(meWire(actor))
      }
      return successfulRead(input)
    }),
  )
  const { user, queryClient } = renderWithRouter(`/repos/${fixture.review.repository_id}/pull-requests`, {
    dataSource: new ApiPullRequestDataSource(),
    session: { ...fakeMe, user: { ...fakeMe.user, id: 'user-2', login: 'grace' } },
  })
  await screen.findAllByRole('button', { name: 'Start review' })
  actor = 'A'
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: meQueryKey })
  })
  await screen.findByText('ada')
  const start = (await screen.findAllByRole('button', { name: 'Start review' }))[0]
  await user.click(start)
  actor = 'B'
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: meQueryKey })
  })
  await screen.findByText('grace')
  expect(screen.getAllByRole('button', { name: 'Start review' })[0]).toBe(start)
  await act(async () => {
    completeStart(new Response(null, { status: 401 }))
  })
  let interrupted = false
  if (completeMe) {
    await screen.findByText('Loading session…')
    interrupted = true
    await act(async () => {
      completeMe!(Response.json(meWire('B')))
    })
  }
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  expect(interrupted).toBe(false)
  expect(meReads).toBe(2)
  expect(screen.getByText('grace')).toBeInTheDocument()
})
