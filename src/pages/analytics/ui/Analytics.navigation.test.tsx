import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AnalyticsPage } from '@/pages/analytics'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

it('opens audit with the repository and period selected in analytics', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
  const { user, router } = renderWithRouter('/analytics?repository=one&days=7', {
    routes: [
      { path: '/analytics', element: <AnalyticsPage /> },
      { path: '/audit', element: <h1>Selected review audit</h1> },
    ],
  })
  await user.click(await screen.findByRole('link', { name: 'View audit log' }))
  expect(await screen.findByRole('heading', { name: 'Selected review audit' })).toBeInTheDocument()
  expect(router.state.location.search).toBe('?repository=one&days=7')
})

it('announces that analytics is loading while its request is pending', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
  renderWithRouter('/analytics?repository=one&days=7', {
    routes: [{ path: '/analytics', element: <AnalyticsPage /> }],
  })
  expect(await screen.findByText('Loading analytics…')).toHaveAttribute('role', 'status')
})

it('explains how to start when no repository is selected', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
  renderWithRouter('/analytics', { routes: [{ path: '/analytics', element: <AnalyticsPage /> }] })
  expect(await screen.findByText('Select a repository to view analytics.')).toBeInTheDocument()
  expect(screen.queryByText('Loading analytics…')).not.toBeInTheDocument()
})
