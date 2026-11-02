import { screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuditPage } from '@/pages/audit'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())
const repositories = {
  items: [
    {
      id: 'one',
      provider: 'github',
      external_id: '1',
      owner: 'team',
      name: 'one',
      role: 'reviewer',
      capabilities: { can_start_review: true, can_manage_settings: false },
    },
  ],
  next_cursor: null,
}
const auditRow = (id: string, login = 'ada') => ({
  id,
  pull_request_number: 42,
  requested_head_sha: 'a'.repeat(40),
  status: 'PARTIAL',
  publication_status: 'PENDING',
  created_at: '2026-10-30T12:00:00Z',
  started_at: '2026-10-30T12:00:01Z',
  finished_at: '2026-10-30T12:00:05Z',
  trigger_type: 'manual',
  actor: { id: 'user-1', login },
  usage: {
    input_tokens: 120,
    output_tokens: 0,
    reserved_input_tokens: 1000,
    reserved_output_tokens: 200,
    status: 'incomplete',
  },
  limit_reasons: [],
  cost: { amount: null, currency: null, status: 'unavailable' },
})

test('audit identifies the trigger actor and distinguishes known usage, reservations and unavailable cost', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).includes('/reviews?') ? { items: [auditRow('review-1')], next_cursor: null } : repositories,
      ),
    ),
  )
  renderWithRouter('/audit?repository=one&days=7', { routes: [{ path: '/audit', element: <AuditPage /> }] })
  const actor = await screen.findByText('ada')
  const row = actor.closest('tr')!
  expect(within(row).getByText('manual')).toBeInTheDocument()
  expect(within(row).getByText('120 input / 0 output')).toBeInTheDocument()
  expect(within(row).getByText('Incomplete usage')).toBeInTheDocument()
  expect(within(row).getByText('Reserved: 1000 input / 200 output')).toBeInTheDocument()
  expect(within(row).getByText('Cost unavailable')).toBeInTheDocument()
  expect(within(row).getByRole('link', { name: 'PR #42' })).toHaveAttribute('href', '/reviews/review-1')
  expect(within(row).getByText('PARTIAL')).toBeInTheDocument()
  expect(within(row).getByText('Publication: PENDING')).toBeInTheDocument()
})

test('missing actor and actual token counts are not presented as zero', async () => {
  const unknown = {
    ...auditRow('unknown'),
    actor: null,
    usage: {
      input_tokens: null,
      output_tokens: null,
      reserved_input_tokens: 500,
      reserved_output_tokens: 100,
      status: 'unavailable',
    },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      Response.json(String(input).includes('/reviews?') ? { items: [unknown], next_cursor: null } : repositories),
    ),
  )
  renderWithRouter('/audit?repository=one', { routes: [{ path: '/audit', element: <AuditPage /> }] })
  expect(await screen.findByText('Unknown actor')).toBeInTheDocument()
  expect(screen.getByText('Usage unavailable')).toBeInTheDocument()
  expect(screen.getByText('Unknown input / Unknown output')).toBeInTheDocument()
  expect(screen.queryByText('0 input / 0 output')).not.toBeInTheDocument()
})

test('loads the next cursor page once and keeps the earlier rows', async () => {
  const calls: { path: string; credentials?: RequestCredentials }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      calls.push({ path, credentials: init?.credentials })
      if (path.includes('/reviews?'))
        return Response.json(
          path.includes('cursor=')
            ? { items: [auditRow('second', 'grace')], next_cursor: null }
            : { items: [auditRow('first')], next_cursor: 'next+page=' },
        )
      return Response.json(repositories)
    }),
  )
  const { user } = renderWithRouter('/audit?repository=one&days=7', {
    routes: [{ path: '/audit', element: <AuditPage /> }],
  })
  await screen.findByText('ada')
  await user.click(screen.getByRole('button', { name: 'Load more' }))
  expect(await screen.findByText('grace')).toBeInTheDocument()
  expect(screen.getByText('ada')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  expect(calls.filter(({ path }) => path.includes('/reviews?'))).toEqual([
    { path: '/api/v1/repositories/one/reviews?days=7&limit=20', credentials: 'include' },
    { path: '/api/v1/repositories/one/reviews?days=7&limit=20&cursor=next%2Bpage%3D', credentials: 'include' },
  ])
})

test('changing status resets loaded pages and puts the filter in the URL', async () => {
  const paths: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      paths.push(path)
      if (path.includes('/reviews?'))
        return Response.json(
          path.includes('status=FAILED')
            ? { items: [{ ...auditRow('failed', 'linus'), status: 'FAILED' }], next_cursor: null }
            : path.includes('cursor=')
              ? { items: [auditRow('second', 'grace')], next_cursor: null }
              : { items: [auditRow('first')], next_cursor: 'next' },
        )
      return Response.json(repositories)
    }),
  )
  const { user, router } = renderWithRouter('/audit?repository=one&days=7', {
    routes: [{ path: '/audit', element: <AuditPage /> }],
  })
  await screen.findByText('ada')
  await user.click(screen.getByRole('button', { name: 'Load more' }))
  await screen.findByText('grace')
  await user.selectOptions(screen.getByLabelText('Analysis status'), 'FAILED')
  expect(await screen.findByText('linus')).toBeInTheDocument()
  expect(screen.queryByText('grace')).not.toBeInTheDocument()
  expect(router.state.location.search).toBe('?repository=one&days=7&status=FAILED')
  expect(paths[paths.length - 1]).toBe('/api/v1/repositories/one/reviews?days=7&limit=20&status=FAILED')
})

test('persisted coverage limits explain partial analysis without claiming the PR was rejected', async () => {
  const limited = { ...auditRow('limited'), limit_reasons: ['file_limit', 'line_limit', 'token_budget'] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      Response.json(String(input).includes('/reviews?') ? { items: [limited], next_cursor: null } : repositories),
    ),
  )
  renderWithRouter('/audit?repository=one', { routes: [{ path: '/audit', element: <AuditPage /> }] })
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Analysis limited: file count, line count, token budget. Some changes were not analyzed.',
  )
  expect(within(screen.getByRole('table')).getByText('PARTIAL')).toBeInTheDocument()
})

test('access revocation on a later audit page hides previously loaded private rows', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.includes('cursor=')) return new Response(null, { status: 403 })
      if (path.includes('/reviews?')) return Response.json({ items: [auditRow('first')], next_cursor: 'next' })
      return Response.json(repositories)
    }),
  )
  const { user } = renderWithRouter('/audit?repository=one', { routes: [{ path: '/audit', element: <AuditPage /> }] })
  await screen.findByText('ada')
  await user.click(screen.getByRole('button', { name: 'Load more' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This repository is unavailable or access was revoked.')
  expect(screen.queryByText('ada')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
})

test('audit distinguishes an in-flight request from a completed empty result', async () => {
  let resolveAudit!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/reviews?')
        ? new Promise<Response>((resolve) => {
            resolveAudit = resolve
          })
        : Response.json(repositories),
    ),
  )
  renderWithRouter('/audit?repository=one', { routes: [{ path: '/audit', element: <AuditPage /> }] })
  expect(await screen.findByText('Loading review audit…')).toBeInTheDocument()
  resolveAudit(Response.json({ items: [], next_cursor: null }))
  expect(await screen.findByText('No review runs match these filters.')).toBeInTheDocument()
  expect(screen.queryByText('Loading review audit…')).not.toBeInTheDocument()
})
