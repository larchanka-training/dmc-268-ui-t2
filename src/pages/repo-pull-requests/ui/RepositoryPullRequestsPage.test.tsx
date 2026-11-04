import { screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { RepositoryPullRequestsPage } from '@/pages/repo-pull-requests'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

function pullRequestWire(number: number, title: string) {
  return {
    number,
    title,
    author: { login: 'ada-lovelace' },
    state: 'OPEN',
    source: { repository_external_id: '1001', ref: `feature/pr-${number}`, sha: `sha-${number}` },
    base: { repository_external_id: '1001', ref: 'main', sha: 'base-sha' },
  }
}

type StartResponse = () => Response | Promise<Response>

function stubApi(startResponse?: StartResponse | StartResponse[]) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init: init ?? {} })
      if (url.includes('/pull-requests/') && url.endsWith('/reviews') && startResponse) {
        const next = Array.isArray(startResponse) ? startResponse.shift() : startResponse
        if (next) return next()
      }
      if (url.includes('/repositories/repo-1/pull-requests')) {
        return Response.json({
          items: [pullRequestWire(42, 'Add user metadata'), pullRequestWire(43, 'Fix pagination')],
          next_cursor: null,
        })
      }
      return Response.json({ items: [], next_cursor: null })
    }),
  )
  return calls
}

test('lists open pull requests of the connected repository from GET /repositories/{id}/pull-requests', async () => {
  const calls = stubApi()

  renderWithRouter('/repos/repo-1/pull-requests')

  const first = (await screen.findByText('Add user metadata')).closest('li') as HTMLElement
  expect(within(first).getByText('#42')).toBeInTheDocument()
  expect(within(first).getByText(/ada-lovelace/)).toBeInTheDocument()
  expect(within(first).getByText(/feature\/pr-42/)).toBeInTheDocument()
  expect(screen.getByText('Fix pagination')).toBeInTheDocument()
  expect(calls[0].url).toBe('/api/v1/repositories/repo-1/pull-requests?limit=20')
})

const accepted = () =>
  Response.json({ review_id: 'rev-77', status: 'QUEUED', resource_url: '/api/v1/reviews/rev-77' }, { status: 202 })

function renderPage() {
  return renderWithRouter('/repos/repo-1/pull-requests', {
    routes: [
      { path: '/repos/:repositoryId/pull-requests', element: <RepositoryPullRequestsPage /> },
      { path: '/reviews/:reviewId', element: <p>Review detail</p> },
    ],
  })
}

test('Start review POSTs with CSRF + Idempotency-Key and opens /reviews/{id}', async () => {
  const calls = stubApi(accepted)
  const { user, router } = renderPage()

  const row = (await screen.findByText('Fix pagination')).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Start review' }))

  expect(await screen.findByText('Review detail')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/reviews/rev-77')
  const start = calls.find((c) => c.url.endsWith('/pull-requests/43/reviews'))
  expect(start?.url).toBe('/api/v1/repositories/repo-1/pull-requests/43/reviews')
  expect(start?.init.method).toBe('POST')
  const headers = start?.init.headers as Record<string, string>
  expect(headers['X-CSRF-Token']).toBe('csrf')
  expect(headers['Idempotency-Key']).toMatch(/\S+/)
  expect(JSON.parse(String(start?.init.body))).toEqual({ requested_head_sha: 'sha-43' })
})

test('409 INTEGRATION_UNHEALTHY shows a distinct integration message and stays on the list', async () => {
  stubApi(() =>
    Response.json(
      {
        code: 'INTEGRATION_UNHEALTHY',
        message: 'The repository integration is unhealthy.',
        request_id: 'req_1',
        retryable: false,
        retry_after: null,
      },
      { status: 409 },
    ),
  )
  const { user, router } = renderPage()

  const row = (await screen.findByText('Add user metadata')).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Start review' }))

  expect(await within(row).findByRole('alert')).toHaveTextContent(/integration .*unhealthy/i)
  expect(router.state.location.pathname).toBe('/repos/repo-1/pull-requests')
})

test('other start failures keep a generic message, not the integration one', async () => {
  stubApi(() => Response.json({ code: 'REVIEW_ALREADY_ACTIVE', message: 'x' }, { status: 409 }))
  const { user } = renderPage()

  const row = (await screen.findByText('Add user metadata')).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Start review' }))

  expect(await within(row).findByRole('alert')).toHaveTextContent('Could not start review. Try again.')
})

function startCalls(calls: Array<{ url: string; init: RequestInit }>) {
  return calls.filter((c) => c.init.method === 'POST' && c.url.endsWith('/pull-requests/42/reviews'))
}

function idempotencyKey(call: { init: RequestInit }) {
  return (call.init.headers as Record<string, string>)['Idempotency-Key']
}

test.each([
  [
    'a lost response',
    () => {
      throw new TypeError('network')
    },
  ],
  ['a 5xx response', () => new Response(null, { status: 503 })],
])('retry after %s reuses the Idempotency-Key', async (_label, first) => {
  const calls = stubApi([first, accepted])
  const { user, router } = renderPage()

  const row = (await screen.findByText('Add user metadata')).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Start review' }))
  expect(await within(row).findByRole('alert')).toBeInTheDocument()
  await user.click(within(row).getByRole('button', { name: 'Start review' }))

  expect(await screen.findByText('Review detail')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/reviews/rev-77')
  const starts = startCalls(calls)
  expect(starts).toHaveLength(2)
  expect(idempotencyKey(starts[0])).toMatch(/\S+/)
  expect(idempotencyKey(starts[1])).toBe(idempotencyKey(starts[0]))
})

test('definitive 4xx gets a fresh key next time', async () => {
  const calls = stubApi([
    () => Response.json({ code: 'REVIEW_ALREADY_ACTIVE', message: 'x' }, { status: 409 }),
    accepted,
  ])
  const { user } = renderPage()

  const row = (await screen.findByText('Add user metadata')).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Start review' }))
  expect(await within(row).findByRole('alert')).toBeInTheDocument()
  await user.click(within(row).getByRole('button', { name: 'Start review' }))

  expect(await screen.findByText('Review detail')).toBeInTheDocument()
  const starts = startCalls(calls)
  expect(starts).toHaveLength(2)
  expect(idempotencyKey(starts[1])).not.toBe(idempotencyKey(starts[0]))
})
