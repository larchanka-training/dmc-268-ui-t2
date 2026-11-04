import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { meQueryKey, useMeQuery, type Me } from '@/entities/session'
import { fetchRepositorySettings, fetchRepositoryRulesPreview, SettingsHttpError } from './settings-client'

async function recheckSession(
  client: QueryClient,
  error: unknown,
  signal: AbortSignal,
  actorId: string | undefined,
): Promise<void> {
  if (
    error instanceof SettingsHttpError &&
    error.status === 401 &&
    !signal.aborted &&
    actorId !== undefined &&
    client.getQueryData<Me>(meQueryKey)?.user.id === actorId
  ) {
    await client.resetQueries({ queryKey: meQueryKey })
  }
}

export const repositorySettingsKey = (userId: string | undefined, repositoryId: string) =>
  ['repository-settings', userId, repositoryId, 'settings'] as const

export function useRepositorySettings(repositoryId: string) {
  const userId = useMeQuery().data?.user.id
  const client = useQueryClient()
  return useQuery({
    queryKey: repositorySettingsKey(userId, repositoryId),
    gcTime: 0,
    queryFn: async ({ signal }) => {
      try {
        return await fetchRepositorySettings(repositoryId, signal)
      } catch (error) {
        await recheckSession(client, error, signal, userId)
        throw error
      }
    },
    enabled: Boolean(userId && repositoryId),
  })
}

export function useRepositoryRulesPreview(repositoryId: string) {
  const userId = useMeQuery().data?.user.id
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['repository-settings', userId, repositoryId, 'preview'],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      try {
        return await fetchRepositoryRulesPreview(repositoryId, signal)
      } catch (error) {
        await recheckSession(client, error, signal, userId)
        throw error
      }
    },
    enabled: Boolean(userId && repositoryId),
  })
  useEffect(() => {
    const error = query.error
    if (!(error instanceof SettingsHttpError) || ![403, 404].includes(error.status)) return
    const scope = { queryKey: ['repository-settings', userId, repositoryId] }
    client.removeQueries({ ...scope, type: 'inactive' })
    const active = client.getQueryCache().findAll(scope)
    // Preserve active observers with an explicit denial; cancelled GETs cannot restore their data.
    void client.cancelQueries(scope, { revert: false }).then(() => {
      for (const entry of active)
        entry.setState({
          data: undefined,
          dataUpdatedAt: 0,
          error,
          errorUpdatedAt: Date.now(),
          status: 'error',
          fetchStatus: 'idle',
        })
    })
  }, [client, query.error, userId, repositoryId])
  return query
}
