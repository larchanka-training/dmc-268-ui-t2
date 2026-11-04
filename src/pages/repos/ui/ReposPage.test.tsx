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

const adminWire = {
  ...connectedWire,
  role: 'admin',
  capabilities: { can_start_review: true, can_manage_settings: true },
}

function stubReposApi(listItem: typeof connectedWire, connectResponse?: () => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init: init ?? {} })
      if (init?.method === 'POST' && url.includes('/repositories/connect') && connectResponse) {
        return connectResponse()
      }
      if (url.includes('/pull-requests')) {
        return Response.json({ items: [], next_cursor: null })
      }
      return Response.json({ items: [listItem], next_cursor: null })
    }),
  )
  return calls
}

test('admin row Check access re-POSTs connect for the connected repo', async () => {
  const calls = stubReposApi(adminWire, () => Response.json(adminWire, { status: 200 }))
  const { user } = renderWithRouter('/repos')

  const row = (await screen.findByText('octocat/hello')).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Check access' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Access confirmed.')
  const posts = calls.filter((c) => c.init.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0].url).toBe('/api/v1/repositories/connect')
  expect(JSON.parse(String(posts[0].init.body))).toEqual({ provider: 'github', external_id: '1001' })
  expect((posts[0].init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf')
})

test('409 BOT_ACCESS_REQUIRED shows bot login and invite steps', async () => {
  stubReposApi(adminWire, () =>
    Response.json(
      {
        code: 'BOT_ACCESS_REQUIRED',
        message: 'x',
        bot_login: 'review-bot',
        access_url: 'https://github.com/octocat/hello/settings/access',
      },
      { status: 409 },
    ),
  )
  const { user } = renderWithRouter('/repos')

  const row = (await screen.findByText('octocat/hello')).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: 'Check access' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('review-bot')
  expect(within(alert).getByRole('button', { name: 'Check again' })).toBeInTheDocument()
})

test('reviewer row has no Check access', async () => {
  stubReposApi(connectedWire)
  renderWithRouter('/repos')

  await screen.findByText('octocat/hello')
  expect(screen.queryByRole('button', { name: 'Check access' })).toBeNull()
})
