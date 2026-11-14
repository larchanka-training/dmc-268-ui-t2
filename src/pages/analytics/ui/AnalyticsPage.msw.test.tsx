import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { reposHandlers } from '@/app/msw/handlers'
import { insightsHandlers } from '@/app/msw/insights-handlers'
import { connectRepositoryInStore, resetRepositoryStore } from '@/app/msw/repos-store'
import { clearSessionCookie, setSessionCookie } from '@/app/msw/session-cookie'
import { AnalyticsPage } from '@/pages/analytics'
import { renderWithRouter } from '@/test/render-with-router'

const server = setupServer(...insightsHandlers, ...reposHandlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  connectRepositoryInStore('github', '1001')
  setSessionCookie()
  const interceptedFetch = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
    interceptedFetch(new URL(String(input), window.location.origin), init),
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  server.resetHandlers()
  clearSessionCookie()
  resetRepositoryStore()
})

function openAnalytics() {
  return renderWithRouter('/analytics?repository=connected-1001&days=7', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
}

test('keyboard chart help explains the visible period and how to read daily category counts', async () => {
  const { user } = openAnalytics()
  const table = await screen.findByRole('table', { name: 'Daily findings, UTC' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(7)
  expect(
    within(rows[0])
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['0', '0', '0', '0'])
  expect(
    within(rows[1])
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['1', '1', '1', '1'])

  const help = screen.getByRole('button', { name: 'How to read this chart' })
  screen.getByRole('link', { name: 'View audit log' }).focus()
  await user.tab()
  expect(help).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(help).toHaveAttribute('aria-expanded', 'true')
  const tip = screen.getByRole('region', { name: 'How to read this chart' })
  expect(tip).toHaveTextContent(within(rows[0]).getByRole('rowheader').textContent!)
  expect(tip).toHaveTextContent(within(rows[6]).getByRole('rowheader').textContent!)
  expect(tip).toHaveTextContent(/created on that UTC day/)
  expect(tip).toHaveTextContent(/zero.*no findings/i)
  await user.keyboard(' ')
  expect(help).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('region', { name: 'How to read this chart' })).toBeNull()
})

test('a broken run summary leaves chart data and navigation available', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  server.use(
    http.get('/api/v1/repositories/:id/analytics', () =>
      HttpResponse.json({
        period: { date_from: '2026-10-24', date_to: '2026-10-30', timezone: 'UTC' },
        totals: null,
        findings_by_day: [{ date: '2026-10-30', security: 3, correctness: 0, performance: 1, maintainability: 0 }],
        average_duration_ms: null,
        duration_sample_count: 0,
      }),
    ),
  )
  openAnalytics()
  expect(await screen.findByRole('button', { name: 'Обновить страницу' })).toBeVisible()
  expect(screen.getByRole('row', { name: '2026-10-30 3 0 1 0' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'View audit log' })).toBeVisible()
})

test('a broken limit response leaves run metrics, the chart and navigation available', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  server.use(http.get('/api/v1/repositories/:id/quotas', () => HttpResponse.json({ active_jobs: null })))
  openAnalytics()
  expect(await screen.findByRole('button', { name: 'Обновить страницу' })).toBeVisible()
  expect(screen.getByText('Review runs')).toBeVisible()
  expect(screen.getByRole('img', { name: 'Daily findings by category' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'View audit log' })).toBeVisible()
})
