import { setupServer } from 'msw/node'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { insightsHandlers } from './insights-handlers'
import { connectRepositoryInStore, resetRepositoryStore } from './repos-store'
import { clearSessionCookie, setSessionCookie } from './session-cookie'

const server = setupServer(...insightsHandlers)
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  resetRepositoryStore()
  connectRepositoryInStore('github', '1001')
  setSessionCookie()
})
afterAll(() => {
  clearSessionCookie()
  resetRepositoryStore()
  server.close()
})

test('the demo honors a one-run badge history page and can continue from its cursor', async () => {
  const url = new URL('/api/v1/repositories/connected-1001/reviews?days=90&limit=1', window.location.origin)
  const first = await (await fetch(url)).json()
  expect(first.items).toHaveLength(1)
  expect(first.next_cursor).toEqual(expect.any(String))
  url.searchParams.set('cursor', first.next_cursor)
  const second = await (await fetch(url)).json()
  expect(second.items).toHaveLength(1)
  expect(second.items[0].id).not.toBe(first.items[0].id)
})
