import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  connectRepository,
  fetchAvailableRepositories,
  fetchConnectedRepositories,
  RepositoryHttpError,
} from '@/entities/repository/api/repository-client'
import type { ConnectRepositoryBody } from '@/entities/repository/model/types'

export const connectedRepositoriesQueryKey = ['repositories', 'connected'] as const
export const availableRepositoriesQueryKey = ['repositories', 'available'] as const

function noRetryOn401(failureCount: number, error: Error): boolean {
  if (error instanceof RepositoryHttpError && error.status === 401) {
    return false
  }
  return failureCount < 1
}

export function useConnectedRepositoriesQuery() {
  return useQuery({
    queryKey: connectedRepositoriesQueryKey,
    queryFn: fetchConnectedRepositories,
    retry: noRetryOn401,
  })
}

export function useAvailableRepositoriesQuery() {
  return useQuery({
    queryKey: availableRepositoriesQueryKey,
    queryFn: fetchAvailableRepositories,
    retry: noRetryOn401,
  })
}

export function useConnectRepositoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: ConnectRepositoryBody) => connectRepository(body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: connectedRepositoriesQueryKey }),
        queryClient.invalidateQueries({ queryKey: availableRepositoriesQueryKey }),
      ])
    },
  })
}
