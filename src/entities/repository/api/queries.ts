import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  connectRepository,
  fetchAvailableRepositories,
  fetchConnectedRepositories,
  RepositoryHttpError,
} from '@/entities/repository/api/repository-client'
import type { ConnectRepositoryBody } from '@/entities/repository/model/types'
import { meQueryKey } from '@/entities/session'

export const connectedRepositoriesQueryKey = ['repositories', 'connected'] as const
export const availableRepositoriesQueryKey = ['repositories', 'available'] as const

function noRetryOn401(failureCount: number, error: Error): boolean {
  if (error instanceof RepositoryHttpError && error.status === 401) {
    return false
  }
  return failureCount < 1
}

/** Drop cached `/me` so RequireAuth sends the user back to login. */
async function clearSessionIfUnauthorized(queryClient: QueryClient, error: unknown): Promise<void> {
  if (error instanceof RepositoryHttpError && error.status === 401) {
    await queryClient.resetQueries({ queryKey: meQueryKey })
  }
}

async function fetchConnectedRepositoriesGuarded(queryClient: QueryClient) {
  try {
    return await fetchConnectedRepositories()
  } catch (error) {
    await clearSessionIfUnauthorized(queryClient, error)
    throw error
  }
}

async function fetchAvailableRepositoriesGuarded(queryClient: QueryClient) {
  try {
    return await fetchAvailableRepositories()
  } catch (error) {
    await clearSessionIfUnauthorized(queryClient, error)
    throw error
  }
}

export function useConnectedRepositoriesQuery() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: connectedRepositoriesQueryKey,
    queryFn: () => fetchConnectedRepositoriesGuarded(queryClient),
    retry: noRetryOn401,
  })
}

export function useAvailableRepositoriesQuery() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: availableRepositoriesQueryKey,
    queryFn: () => fetchAvailableRepositoriesGuarded(queryClient),
    retry: noRetryOn401,
  })
}

export function useConnectRepositoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: ConnectRepositoryBody) => {
      try {
        return await connectRepository(body)
      } catch (error) {
        await clearSessionIfUnauthorized(queryClient, error)
        throw error
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: connectedRepositoriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: availableRepositoriesQueryKey }),
      ])
    },
  })
}
