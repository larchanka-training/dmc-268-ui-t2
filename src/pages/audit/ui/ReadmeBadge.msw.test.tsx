import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { insightsHandlers } from '@/app/msw/insights-handlers'
import { reposHandlers } from '@/app/msw/handlers'
import { connectRepositoryInStore, resetRepositoryStore } from '@/app/msw/repos-store'
import { clearSessionCookie, setSessionCookie } from '@/app/msw/session-cookie'
import { AuditPage } from '@/pages/audit'
import { renderWithRouter } from '@/test/render-with-router'

const reviews = '/api/v1/repositories/one/reviews'
const server = setupServer(
  http.get('/api/v1/repositories', () =>
    HttpResponse.json({
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
    }),
  ),
)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  const interceptedFetch = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
    interceptedFetch(new URL(String(input), window.location.origin), init),
  )
})
afterEach(() => {
  server.resetHandlers()
  clearSessionCookie()
  resetRepositoryStore()
  vi.restoreAllMocks()
})

function openAudit() {
  return renderWithRouter('/audit?repository=one&days=7&status=FAILED', {
    routes: [{ path: '/audit', element: <AuditPage /> }],
  })
}

test('downloads a README snapshot of the latest analysis execution independent of audit filters', async () => {
  server.use(
    http.get(reviews, ({ request }) => {
      const params = new URL(request.url).searchParams
      if (params.get('status') === 'FAILED') return HttpResponse.json({ items: [], next_cursor: null })
      if (params.get('days') !== '90' || params.get('limit') !== '1' || params.has('cursor') || params.has('status'))
        return new HttpResponse(null, { status: 422 })
      return HttpResponse.json({
        items: [
          {
            id: 'private-review-id',
            status: 'COMPLETED',
            publication_status: 'FAILED',
            created_at: '2026-11-11T08:06:05Z',
            actor: { id: 'actor', login: 'private-login' },
          },
        ],
        next_cursor: 'another-page',
      })
    }),
  )
  const { user } = openAudit()
  await user.click(screen.getByRole('button', { name: 'Generate README badge' }))
  const download = await screen.findByRole('link', { name: 'Download SVG' })
  expect(download).toHaveAttribute('download', 'review-status.svg')
  const svg = decodeURIComponent(download.getAttribute('href')!.split(',')[1])
  const image = new DOMParser().parseFromString(svg, 'image/svg+xml')
  expect(image.documentElement.tagName).toBe('svg')
  expect(image.documentElement.textContent).toContain('Completed')
  expect(image.documentElement.textContent).toContain('2026-11-11T08:06:05')
  expect(svg).not.toMatch(/passed|private-login|private-review-id|FAILED|csrf|demo/i)
  expect(screen.getByLabelText('README Markdown')).toHaveValue('![Latest review run](./review-status.svg)')
})

test('exports a bounded empty-window badge when older reviews cannot be ruled out', async () => {
  server.use(http.get(reviews, () => HttpResponse.json({ items: [], next_cursor: null })))
  const { user } = openAudit()
  await user.click(screen.getByRole('button', { name: 'Generate README badge' }))
  expect(await screen.findByRole('img', { name: 'Review run: None in 90 days' })).toBeInTheDocument()
  const href = screen.getByRole('link', { name: 'Download SVG' }).getAttribute('href')!
  expect(decodeURIComponent(href)).toContain('None in 90 days')
})

test('refresh reads again and removes the prior export during the request and after failure', async () => {
  let finishRefresh!: () => void
  let reads = 0
  server.use(
    http.get(reviews, ({ request }) => {
      if (!new URL(request.url).searchParams.has('status') && ++reads > 1)
        return new Promise<HttpResponse<null>>((resolve) => {
          finishRefresh = () => resolve(new HttpResponse(null, { status: 503 }))
        })
      return HttpResponse.json({ items: [], next_cursor: null })
    }),
  )
  const { user } = openAudit()
  await user.click(screen.getByRole('button', { name: 'Generate README badge' }))
  await screen.findByRole('link', { name: 'Download SVG' })
  await user.click(screen.getByRole('button', { name: 'Refresh badge' }))
  expect(screen.queryByRole('link', { name: 'Download SVG' })).not.toBeInTheDocument()
  expect(screen.getByText('Loading latest review run…')).toBeInTheDocument()
  finishRefresh()
  expect(await screen.findByText(/badge unavailable/i)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Download SVG' })).not.toBeInTheDocument()
})

test('unsupported history data cannot appear in the exported SVG', async () => {
  server.use(
    http.get(reviews, ({ request }) =>
      HttpResponse.json({
        items: new URL(request.url).searchParams.has('status')
          ? []
          : [
              {
                status: '<private status>',
                created_at: '2026-11-01T16:01:20Z',
              },
            ],
        next_cursor: null,
      }),
    ),
  )
  const { user } = openAudit()
  await user.click(screen.getByRole('button', { name: 'Generate README badge' }))
  expect(await screen.findByText(/badge unavailable.*history data/i)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Download SVG' })).not.toBeInTheDocument()
})

test.each([
  ['null creation time', { items: [{ status: 'COMPLETED', created_at: null }], next_cursor: null }],
  ['array status', { items: [{ status: ['COMPLETED'], created_at: '2026-11-01T16:01:20Z' }], next_cursor: null }],
  ['null row', { items: [null], next_cursor: null }],
  ['null page', null],
])('reports unavailable history for a %s', async (_, page) => {
  server.use(
    http.get(reviews, ({ request }) =>
      HttpResponse.json(new URL(request.url).searchParams.has('status') ? { items: [], next_cursor: null } : page),
    ),
  )
  const { user } = openAudit()
  await user.click(screen.getByRole('button', { name: 'Generate README badge' }))
  expect(await screen.findByText(/badge unavailable.*history data/i)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Download SVG' })).not.toBeInTheDocument()
})

test('marks MSW history as a demo in the preview and in the visible SVG text', async () => {
  server.use(...reposHandlers, ...insightsHandlers)
  connectRepositoryInStore('github', '1001')
  setSessionCookie()
  const { user } = renderWithRouter('/audit?repository=connected-1001', {
    routes: [{ path: '/audit', element: <AuditPage /> }],
  })
  await user.click(screen.getByRole('button', { name: 'Generate README badge' }))
  const image = await screen.findByRole('img', { name: /Demo review run/i })
  const href = screen.getByRole('link', { name: 'Download SVG' }).getAttribute('href')!
  expect(image).toHaveAttribute('src', href)
  const svg = new DOMParser().parseFromString(decodeURIComponent(href.split(',')[1]), 'image/svg+xml')
  expect(Array.from(svg.querySelectorAll('text'), (element) => element.textContent)).toContain('Demo review run')
})
