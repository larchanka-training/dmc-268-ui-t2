import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reviewCancellationPath } from '@/entities/pull-request/model/paths'
import { meQueryKey, type Me } from '@/entities/session'
import { useCancelReviewMutation } from '@/entities/pull-request/api/queries'

const fakeMe: Me = {
  user: { id: 'user-1', provider: 'github', externalId: '1', login: 'ada' },
  session: { expiresAt: '2999-01-01T00:00:00Z' },
  csrfToken: 'csrf-token',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

describe('useCancelReviewMutation', () => {
  it('resets session on 401 so RequireAuth can send the user to login', async () => {
    const queryClient = createClient()
    queryClient.setQueryData(meQueryKey, fakeMe)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' })),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useCancelReviewMutation('review-a'), { wrapper })

    await expect(result.current.mutateAsync()).rejects.toThrow()
    await waitFor(() => expect(queryClient.getQueryData(meQueryKey)).toBeUndefined())
    expect(globalThis.fetch).toHaveBeenCalledWith(
      reviewCancellationPath('review-a'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-CSRF-Token': 'csrf-token',
        }),
      }),
    )
  })

  it('reuses Idempotency-Key when retrying after a 500', async () => {
    const queryClient = createClient()
    queryClient.setQueryData(meQueryKey, fakeMe)
    const keys: string[] = []
    let cancelAttempt = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input)
        if (!path.includes('/cancellation') || init?.method !== 'POST') {
          return Response.json({}, { status: 200 })
        }
        const headers = init?.headers
        const idKey =
          headers instanceof Headers
            ? headers.get('Idempotency-Key')
            : (headers as Record<string, string> | undefined)?.['Idempotency-Key']
        keys.push(idKey ?? '')
        cancelAttempt += 1
        if (cancelAttempt === 1) {
          return new Response(null, { status: 500 })
        }
        return new Response(null, { status: 200 })
      }),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useCancelReviewMutation('review-b'), { wrapper })

    await expect(result.current.mutateAsync()).rejects.toThrow()
    await result.current.mutateAsync()
    expect(keys.length).toBe(2)
    expect(keys[0]).toBe(keys[1])
    expect(keys[0]).toMatch(/[0-9a-f-]{36}/i)
  })
})
