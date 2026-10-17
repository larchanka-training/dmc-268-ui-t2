import { afterEach, expect, test, vi } from 'vitest'
import { fetchAvailableRepositories, fetchConnectedRepositories } from '@/entities/repository'

afterEach(() => {
  vi.unstubAllGlobals()
})

function connectedWire(id: string, name: string) {
  return {
    id,
    provider: 'github' as const,
    external_id: id,
    owner: 'octocat',
    name,
    role: 'admin' as const,
    capabilities: {
      can_start_review: true as const,
      can_manage_settings: true,
    },
  }
}

test('fetchConnectedRepositories follows next_cursor until null and repeats limit 20', async () => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      if (calls.length === 1) {
        return Response.json({
          items: [connectedWire('1', 'alpha')],
          next_cursor: 'page+2=',
        })
      }
      return Response.json({
        items: [connectedWire('2', 'beta')],
        next_cursor: null,
      })
    }),
  )

  const repos = await fetchConnectedRepositories()

  expect(repos.map((repo) => repo.name)).toEqual(['alpha', 'beta'])
  expect(calls).toEqual(['/api/v1/repositories?limit=20', '/api/v1/repositories?limit=20&cursor=page%2B2%3D'])
})

function availableWire(id: string, name: string) {
  return {
    provider: 'github' as const,
    external_id: id,
    owner: 'octocat',
    name,
  }
}

test('fetchAvailableRepositories keeps reading when a page has no items but next_cursor is set', async () => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      if (calls.length === 1) {
        return Response.json({
          items: [availableWire('10', 'short')],
          next_cursor: 'after-short',
        })
      }
      if (calls.length === 2) {
        return Response.json({
          items: [],
          next_cursor: 'after-empty',
        })
      }
      return Response.json({
        items: [availableWire('11', 'last')],
        next_cursor: null,
      })
    }),
  )

  const repos = await fetchAvailableRepositories()

  expect(repos.map((repo) => repo.name)).toEqual(['short', 'last'])
  expect(calls).toEqual([
    '/api/v1/repositories/available?limit=20',
    '/api/v1/repositories/available?limit=20&cursor=after-short',
    '/api/v1/repositories/available?limit=20&cursor=after-empty',
  ])
})
