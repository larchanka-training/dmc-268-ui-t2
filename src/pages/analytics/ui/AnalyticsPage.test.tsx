import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AnalyticsPage } from '@/pages/analytics'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

const emptyAnalytics = {
  period: { date_from: '2026-10-24', date_to: '2026-10-30', timezone: 'UTC' },
  totals: { reviews: 0, findings: 0 },
  findings_by_day: [],
  average_duration_ms: null,
  duration_sample_count: 0,
}

function stubFetch(handler: (input: RequestInfo | URL) => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/quotas') ? new Promise<Response>(() => {}) : handler(input),
    ),
  )
}

const repository = (id: string) => ({
  id,
  provider: 'github',
  external_id: id,
  owner: 'team',
  name: id,
  role: 'reviewer',
  capabilities: { can_start_review: true, can_manage_settings: false },
})

test('repository and period selection are retained in the URL', async () => {
  stubFetch(async (input: RequestInfo | URL) =>
    String(input).includes('/analytics')
      ? new Promise<Response>(() => {})
      : Response.json({ items: [repository('one'), repository('two')], next_cursor: null }),
  )
  const { user, router } = renderWithRouter('/analytics?repository=one&days=30', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
  await screen.findByRole('option', { name: 'team/two' })
  await user.selectOptions(screen.getByLabelText('Repository'), 'two')
  await user.selectOptions(screen.getByLabelText('Period'), '7')
  expect(router.state.location.search).toBe('?repository=two&days=7')
})

test('shows server aggregate categories and mean duration with its sample count', async () => {
  stubFetch(async (input: RequestInfo | URL) => {
    if (String(input).includes('/analytics'))
      return Response.json({
        period: { date_from: '2026-10-24', date_to: '2026-10-30', timezone: 'UTC' },
        totals: { reviews: 4, findings: 6 },
        findings_by_day: [{ date: '2026-10-30', security: 1, correctness: 2, performance: 1, maintainability: 2 }],
        average_duration_ms: 12500,
        duration_sample_count: 3,
      })
    return Response.json({ items: [repository('one')], next_cursor: null })
  })
  renderWithRouter('/analytics?repository=one&days=7', { routes: [{ path: '/analytics', element: <AnalyticsPage /> }] })
  expect(await screen.findByText('12.5 s')).toBeInTheDocument()
  expect(screen.getByText('3 completed or partial reviews; queue time excluded.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Daily findings by category' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Performance' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Maintainability' })).toBeInTheDocument()
})

test('an empty period does not claim zero measured duration', async () => {
  stubFetch(async (input: RequestInfo | URL) =>
    String(input).includes('/analytics')
      ? Response.json({
          period: { date_from: '2026-10-24', date_to: '2026-10-30', timezone: 'UTC' },
          totals: { reviews: 0, findings: 0 },
          findings_by_day: [],
          average_duration_ms: null,
          duration_sample_count: 0,
        })
      : Response.json({ items: [repository('one')], next_cursor: null }),
  )
  renderWithRouter('/analytics?repository=one&days=7', { routes: [{ path: '/analytics', element: <AnalyticsPage /> }] })
  expect(await screen.findByText('No reviews in this period.')).toBeInTheDocument()
  expect(screen.getByText('Not available')).toBeInTheDocument()
  expect(screen.queryByText('0.0 s')).not.toBeInTheDocument()
})

test('switching to an inaccessible repository replaces old metrics with a safe error', async () => {
  const requests: string[] = []
  stubFetch(async (input: RequestInfo | URL) => {
    const path = String(input)
    requests.push(path)
    if (path.includes('/two/analytics')) return Response.json({ message: 'sensitive details' }, { status: 403 })
    if (path.includes('/analytics'))
      return Response.json({
        period: { date_from: '2026-10-24', date_to: '2026-10-30', timezone: 'UTC' },
        totals: { reviews: 4, findings: 6 },
        findings_by_day: [],
        average_duration_ms: 12500,
        duration_sample_count: 3,
      })
    return Response.json({ items: [repository('one'), repository('two')], next_cursor: null })
  })
  const { user } = renderWithRouter('/analytics?repository=one&days=7', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
  await screen.findByText('12.5 s')
  await user.selectOptions(screen.getByLabelText('Repository'), 'two')
  expect(await screen.findByRole('alert')).toHaveTextContent('This repository is unavailable or access was revoked.')
  expect(screen.queryByText('12.5 s')).not.toBeInTheDocument()
  expect(screen.queryByText('sensitive details')).not.toBeInTheDocument()
  expect(requests.filter((path) => path.includes('/two/analytics'))).toHaveLength(1)
})

test('expired insights session returns to login without retaining private metrics', async () => {
  const { RequireAuth } = await import('@/app/guards/RequireAuth')
  stubFetch(async (input: RequestInfo | URL) =>
    String(input).includes('/analytics') || String(input).endsWith('/me')
      ? new Response(null, { status: 401 })
      : Response.json({ items: [repository('one')], next_cursor: null }),
  )
  const { router } = renderWithRouter('/analytics?repository=one', {
    routes: [
      {
        path: '/analytics',
        element: (
          <RequireAuth>
            <AnalyticsPage />
          </RequireAuth>
        ),
      },
      { path: '/login', element: <p>Sign in again</p> },
    ],
  })
  expect(await screen.findByText('Sign in again')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
})

test('a user without connected repositories receives a connection action', async () => {
  stubFetch(async () => Response.json({ items: [], next_cursor: null }))
  renderWithRouter('/analytics', { routes: [{ path: '/analytics', element: <AnalyticsPage /> }] })
  expect(await screen.findByRole('link', { name: 'Connect repository' })).toHaveAttribute('href', '/repos/connect')
  expect(screen.getByText('No repositories connected yet.')).toBeInTheDocument()
})

test('exhausted actual start limits are actionable while daily token policy remains unavailable', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/quotas'))
        return Response.json({
          starts_per_hour: {
            limit: 10,
            used: 10,
            remaining: 0,
            resets_at: '2026-10-30T13:00:00Z',
            scope: 'repository_user',
          },
          active_jobs: { limit: 2, used: 2, remaining: 0, scope: 'repository' },
          daily_tokens: { status: 'unavailable' },
        })
      if (String(input).includes('/analytics')) return Response.json(emptyAnalytics)
      return Response.json({ items: [repository('one')], next_cursor: null })
    }),
  )
  renderWithRouter('/analytics?repository=one', { routes: [{ path: '/analytics', element: <AnalyticsPage /> }] })
  expect(await screen.findByText(/Hourly review start limit reached/)).toBeInTheDocument()
  expect(screen.getByText(/Repository active review limit reached/)).toBeInTheDocument()
  expect(screen.getByText('Daily token quota is unavailable; no daily policy is configured.')).toBeInTheDocument()
  expect(screen.getByText('2026-10-30 13:00:00 UTC')).toBeInTheDocument()
})

test('chart categories can be toggled without hiding accessible source counts', async () => {
  stubFetch(async (input) =>
    String(input).includes('/analytics')
      ? Response.json({
          period: { date_from: '2026-10-24', date_to: '2026-10-30', timezone: 'UTC' },
          totals: { reviews: 1, findings: 2 },
          findings_by_day: [{ date: '2026-10-30', security: 2, correctness: 0, performance: 0, maintainability: 0 }],
          average_duration_ms: null,
          duration_sample_count: 0,
        })
      : Response.json({ items: [repository('one')], next_cursor: null }),
  )
  const { user } = renderWithRouter('/analytics?repository=one', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
  const toggle = await screen.findByRole('button', { name: 'Security' })
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByLabelText('Security trend')).not.toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Security' })).toBeInTheDocument()
  await user.click(toggle)
  expect(screen.getByLabelText('Security trend')).toBeInTheDocument()
})

test('changing authenticated user never reuses cached analytics, audit or quota data', async () => {
  const { AuditPage } = await import('@/pages/audit')
  const { meQueryKey } = await import('@/entities/session')
  const { fakeMe } = await import('@/test/render-with-router')
  let nextUser = false
  const secondRequests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.includes('/repositories/one/')) {
        if (nextUser) {
          secondRequests.push(path)
          return path.includes('/analytics') ? Response.json(emptyAnalytics) : new Promise<Response>(() => {})
        }
        if (path.includes('/analytics'))
          return Response.json({
            period: { date_from: '2026-10-24', date_to: '2026-10-30', timezone: 'UTC' },
            totals: { reviews: 1, findings: 0 },
            findings_by_day: [],
            average_duration_ms: 12500,
            duration_sample_count: 1,
          })
        if (path.includes('/quotas'))
          return Response.json({
            starts_per_hour: { used: 10, limit: 10, remaining: 0, resets_at: null, scope: 'repository_user' },
            active_jobs: { used: 0, limit: 2, remaining: 2, scope: 'repository' },
            daily_tokens: { status: 'unavailable' },
          })
        return Response.json({
          items: [
            {
              id: 'private',
              pull_request_number: 42,
              requested_head_sha: 'abc',
              status: 'COMPLETED',
              publication_status: 'PUBLISHED',
              created_at: '2026-10-30T00:00:00Z',
              started_at: null,
              finished_at: null,
              trigger_type: 'manual',
              actor: { id: 'private', login: 'private-actor' },
              usage: {
                input_tokens: 1,
                output_tokens: 1,
                reserved_input_tokens: 0,
                reserved_output_tokens: 0,
                status: 'complete',
              },
              cost: { amount: null, currency: null, status: 'unavailable' },
              limit_reasons: [],
            },
          ],
          next_cursor: null,
        })
      }
      return Response.json({ items: [repository('one')], next_cursor: null })
    }),
  )
  const { queryClient } = renderWithRouter('/insights?repository=one', {
    routes: [
      {
        path: '/insights',
        element: (
          <>
            <AnalyticsPage />
            <AuditPage />
          </>
        ),
      },
    ],
  })
  await screen.findByText('12.5 s')
  await screen.findByText('private-actor')
  await screen.findByText(/Hourly review start limit reached/)
  nextUser = true
  await act(async () => {
    queryClient.setQueryData(meQueryKey, { ...fakeMe, user: { ...fakeMe.user, id: 'other-user' } })
  })
  await waitFor(() => expect(screen.queryByText('12.5 s')).not.toBeInTheDocument())
  expect(screen.queryByText('private-actor')).not.toBeInTheDocument()
  expect(screen.queryByText(/Hourly review start limit reached/)).not.toBeInTheDocument()
  await waitFor(() => expect(secondRequests).toHaveLength(3))
})

test('zero configured limits explain that review starts are disabled', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/quotas'))
        return Response.json({
          starts_per_hour: { used: 0, limit: 0, remaining: 0, resets_at: null, scope: 'repository_user' },
          active_jobs: { used: 0, limit: 0, remaining: 0, scope: 'repository' },
          daily_tokens: { status: 'unavailable' },
        })
      if (String(input).includes('/analytics')) return Response.json(emptyAnalytics)
      return Response.json({ items: [repository('one')], next_cursor: null })
    }),
  )
  renderWithRouter('/analytics?repository=one', { routes: [{ path: '/analytics', element: <AnalyticsPage /> }] })
  expect(
    await screen.findByText('Review starts are disabled by repository limits. Contact a repository administrator.'),
  ).toBeInTheDocument()
  expect(screen.queryByText(/Wait for an active review/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Hourly review start limit reached/)).not.toBeInTheDocument()
})

test('quota request failure remains visible and can be retried', async () => {
  let attempts = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/quotas')) {
        attempts += 1
        return attempts === 1
          ? new Response(null, { status: 503 })
          : Response.json({
              starts_per_hour: { used: 1, limit: 10, remaining: 9, resets_at: null, scope: 'repository_user' },
              active_jobs: { used: 1, limit: 2, remaining: 1, scope: 'repository' },
              daily_tokens: { status: 'unavailable' },
            })
      }
      if (String(input).includes('/analytics')) return Response.json(emptyAnalytics)
      return Response.json({ items: [repository('one')], next_cursor: null })
    }),
  )
  const { user } = renderWithRouter('/analytics?repository=one', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
  expect(await screen.findByText('Could not load current limits.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retry limits' }))
  expect(await screen.findByText('Your starts in this repository: 1 / 10 per hour · 9 remaining')).toBeInTheDocument()
})

test('repository access loss on period change hides the separately cached quota snapshot', async () => {
  let quotaRequests = 0
  let revoked = false
  let originalPeriodRequests = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/quotas')) {
        quotaRequests += 1
        return Response.json({
          starts_per_hour: {
            used: 10,
            limit: 10,
            remaining: 0,
            resets_at: '2026-10-30T13:00:00Z',
            scope: 'repository_user',
          },
          active_jobs: { used: 2, limit: 2, remaining: 0, scope: 'repository' },
          daily_tokens: { status: 'unavailable' },
        })
      }
      if (path.includes('/analytics?days=30')) originalPeriodRequests += 1
      if (path.includes('/analytics?days=90')) revoked = true
      if (path.includes('/analytics') && revoked) return new Response(null, { status: 404 })
      if (path.includes('/analytics'))
        return Response.json({
          period: { date_from: '2026-10-01', date_to: '2026-10-30', timezone: 'UTC' },
          totals: { reviews: 1, findings: 0 },
          findings_by_day: [],
          average_duration_ms: 12500,
          duration_sample_count: 1,
        })
      return Response.json({ items: [repository('one')], next_cursor: null })
    }),
  )
  const { user } = renderWithRouter('/analytics?repository=one&days=30', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
  await screen.findByText('12.5 s')
  await screen.findByText('Your starts in this repository: 10 / 10 per hour · 0 remaining')
  await user.selectOptions(screen.getByLabelText('Period'), '90')
  await screen.findByText('This repository is unavailable or access was revoked.')
  expect(quotaRequests).toBe(1)
  expect(screen.queryByRole('region', { name: 'Repository limits' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Your starts in this repository/)).not.toBeInTheDocument()
  expect(screen.queryByText('12.5 s')).not.toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Period'), '30')
  expect(screen.queryByText(/Your starts in this repository/)).not.toBeInTheDocument()
  await screen.findByText('This repository is unavailable or access was revoked.')
  expect(originalPeriodRequests).toBe(2)
  expect(screen.queryByText('12.5 s')).not.toBeInTheDocument()
})

test('quota access denial hides analytics that have already loaded for the same repository', async () => {
  let denyQuotas!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.endsWith('/quotas'))
        return new Promise<Response>((resolve) => {
          denyQuotas = resolve
        })
      if (path.includes('/analytics'))
        return Response.json({
          ...emptyAnalytics,
          average_duration_ms: 12500,
          duration_sample_count: 1,
          totals: { reviews: 1, findings: 0 },
        })
      return Response.json({ items: [repository('one')], next_cursor: null })
    }),
  )
  renderWithRouter('/analytics?repository=one&days=30', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
  await screen.findByText('12.5 s')
  denyQuotas(new Response(null, { status: 404 }))
  const error = await screen.findByRole('alert')
  expect(screen.queryByText('12.5 s')).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Repository limits' })).not.toBeInTheDocument()
  expect(error).toHaveTextContent('This repository is unavailable or access was revoked.')
  expect(screen.queryByRole('button', { name: 'Retry limits' })).not.toBeInTheDocument()
})
