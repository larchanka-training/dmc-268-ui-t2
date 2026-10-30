import { screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { InsightsFilters } from '@/widgets/insights-filters'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())
const repoPage = {
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

test('repository selection reports loading until the available choices arrive', async () => {
  let respond!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve
        }),
    ),
  )
  renderWithRouter('/filters', { routes: [{ path: '/filters', element: <InsightsFilters /> }] })
  expect(screen.getByRole('status')).toHaveTextContent('Loading repositories…')
  respond(Response.json(repoPage))
  await screen.findByRole('option', { name: 'team/one' })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('repository request errors can be retried without a silent empty selector', async () => {
  let recovered = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => (!recovered ? new Response(null, { status: 503 }) : Response.json(repoPage))),
  )
  const { user } = renderWithRouter('/filters', { routes: [{ path: '/filters', element: <InsightsFilters /> }] })
  expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Could not load repositories.')
  recovered = true
  await user.click(screen.getByRole('button', { name: 'Retry repositories' }))
  await screen.findByRole('option', { name: 'team/one' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
