import { screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ConnectRepoPanel } from '@/features/connect-repo'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

const ACCESS_URL = 'https://github.com/octocat/hello/settings/access'

const connectedWire = {
  id: 'repo-1',
  provider: 'github',
  external_id: '1001',
  owner: 'octocat',
  name: 'hello',
  role: 'admin',
  capabilities: { can_start_review: true, can_manage_settings: true },
}

/** `connectResponses` are served in order, one per POST /repositories/connect call. */
function stubApi(connectResponses: Array<() => Response>) {
  const connectCalls: RequestInit[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/repositories/connect')) {
        connectCalls.push(init ?? {})
        const respond = connectResponses[Math.min(connectCalls.length, connectResponses.length) - 1]
        return respond()
      }
      if (url.includes('/repositories/available')) {
        return Response.json({
          items: [{ provider: 'github', external_id: '1001', owner: 'octocat', name: 'hello' }],
          next_cursor: null,
        })
      }
      return Response.json({ items: [], next_cursor: null })
    }),
  )
  return connectCalls
}

const botAccessRequiredWith =
  (overrides: Record<string, unknown> = {}) =>
  () =>
    Response.json(
      {
        code: 'BOT_ACCESS_REQUIRED',
        message: 'Bot needs Write access.',
        bot_login: 'review-bot',
        access_url: ACCESS_URL,
        ...overrides,
      },
      { status: 409 },
    )

const botAccessRequired = botAccessRequiredWith()
function renderPanel() {
  return renderWithRouter('/repos/connect', {
    routes: [
      { path: '/repos/connect', element: <ConnectRepoPanel /> },
      { path: '/repos', element: <p>Repos list</p> },
    ],
  })
}

test('409 BOT_ACCESS_REQUIRED shows the bot login, an access_url link and the invite steps', async () => {
  stubApi([botAccessRequired])
  const { user } = renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Connect' }))

  expect(await screen.findByText('review-bot')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: /repository access settings/i })
  expect(link).toHaveAttribute('href', ACCESS_URL)
  expect(link).toHaveAttribute('target', '_blank')
  // Приём приглашения — задача оператора бота, а не пользователя.
  expect(screen.getByText(/the bot operator accepts the invitation/i)).toBeInTheDocument()
  expect(screen.queryByText(/sign in as the bot/i)).toBeNull()
  expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
})

test('Check again calls connect again for the same repository and goes to /repos on success', async () => {
  const connectCalls = stubApi([botAccessRequired, () => Response.json(connectedWire, { status: 201 })])
  const { user, router } = renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Connect' }))
  await user.click(await screen.findByRole('button', { name: 'Check again' }))

  expect(await screen.findByText('Repos list')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/repos')
  expect(connectCalls).toHaveLength(2)
  expect(JSON.parse(String(connectCalls[1].body))).toEqual({ provider: 'github', external_id: '1001' })
})

test('503 shows server-config guidance, not the invite steps', async () => {
  stubApi([() => Response.json({ code: 'SERVICE_UNAVAILABLE', message: 'x' }, { status: 503 })])
  const { user } = renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Connect' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/server .*(setup|configuration)/i)
  expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('other failures keep the generic message', async () => {
  stubApi([() => Response.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 })])
  const { user } = renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Connect' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect repository. Try again.')
  expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument()
})

test.each(['javascript:alert(1)', 'http://github.com/octocat/hello/settings/access', 'not a url'])(
  'access_url %s is not rendered as a clickable link',
  async (accessUrl) => {
    stubApi([botAccessRequiredWith({ access_url: accessUrl })])
    const { user } = renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Connect' }))

    expect(await screen.findByText('review-bot')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  },
)

test('empty bot_login does not leave a double space in the copy', async () => {
  stubApi([botAccessRequiredWith({ bot_login: '' })])
  const { user } = renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Connect' }))

  const copy = await screen.findByText(/needs Write access/)
  expect(copy.textContent).toBe('The review bot needs Write access to this repository.')
})
