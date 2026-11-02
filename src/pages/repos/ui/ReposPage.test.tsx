import { screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

const connectedWire = {
  id: 'repo-1',
  provider: 'github',
  external_id: '1001',
  owner: 'octocat',
  name: 'hello',
  role: 'reviewer',
  capabilities: { can_start_review: true, can_manage_settings: false },
}

test('each connected repository links to its pull request list', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/pull-requests')) {
        return Response.json({ items: [], next_cursor: null })
      }
      return Response.json({ items: [connectedWire], next_cursor: null })
    }),
  )

  const { user, router } = renderWithRouter('/repos')

  const row = (await screen.findByText('octocat/hello')).closest('li') as HTMLElement
  const link = within(row).getByRole('link', { name: 'Pull requests' })
  expect(link).toHaveAttribute('href', '/repos/repo-1/pull-requests')

  await user.click(link)

  expect(router.state.location.pathname).toBe('/repos/repo-1/pull-requests')
  expect(await screen.findByRole('heading', { name: 'Open pull requests' })).toBeInTheDocument()
})
