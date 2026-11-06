import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meQueryKey, useMeQuery, type Me } from '@/entities/session'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'
import { recheckReviewSession } from '@/entities/pull-request/api/review-session'
import {
  cancelReview,
  fetchRepositoryPullRequests,
  PullRequestHttpError,
  startReview,
  type StartReviewInput,
} from '@/entities/pull-request/api/pull-request-client'

/** Starts a review for an open PR; resolves to the new review id. */
export function useStartReviewMutation() {
  const queryClient = useQueryClient()
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null)
  const live = useRef(false)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  return useMutation({
    mutationFn: async (input: StartReviewInput) => {
      const me = queryClient.getQueryData<Me>(meQueryKey)
      if (!me?.csrfToken) {
        throw new PullRequestHttpError(401, 'Missing CSRF token')
      }
      const fingerprint = `${input.repositoryId}|${input.number}|${input.headSha}|${input.rerun_of ?? ''}`
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, key: crypto.randomUUID() }
      }
      const { key } = attempt.current
      try {
        const reviewId = await startReview(input, me.csrfToken, key)
        attempt.current = null
        return reviewId
      } catch (error) {
        if (error instanceof PullRequestHttpError && error.status === 401) {
          await queryClient.resetQueries({ queryKey: meQueryKey })
        }
        // Outcome unknown (no response, 5xx, 408, 429): keep the key so a retry replays instead of duplicating.
        const uncertain =
          !(error instanceof PullRequestHttpError) ||
          error.status >= 500 ||
          error.status === 408 ||
          error.status === 429
        if (!uncertain) attempt.current = null
        if (
          error instanceof PullRequestHttpError &&
          error.status === 401 &&
          live.current &&
          queryClient.getQueryData<Me>(meQueryKey)?.user.id === me.user.id
        ) {
          await queryClient.resetQueries({ queryKey: meQueryKey })
        }
        throw error
      }
    },
  })
}

/** Posts cancellation, then refreshes the open review. */
export function useCancelReviewMutation(reviewId: string) {
  const queryClient = useQueryClient()
  const userId = useMeQuery().data?.user.id
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null)
  return useMutation({
    mutationFn: async () => {
      const me = queryClient.getQueryData<Me>(meQueryKey)
      if (!me?.csrfToken) {
        throw new PullRequestHttpError(401, 'Missing CSRF token')
      }
      const fingerprint = reviewId
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, key: crypto.randomUUID() }
      }
      const { key } = attempt.current
      try {
        await cancelReview(reviewId, me.csrfToken, key)
        // Keep the key while this reviewId is mounted so repeat Stop taps replay cancellation (same as start-review uncertain outcomes).
      } catch (error) {
        if (error instanceof PullRequestHttpError && error.status === 401) {
          await queryClient.resetQueries({ queryKey: meQueryKey })
        }
        // Outcome unknown (no response, 5xx, 408, 429): keep the key so a retry replays instead of duplicating.
        const uncertain =
          !(error instanceof PullRequestHttpError) ||
          error.status >= 500 ||
          error.status === 408 ||
          error.status === 429
        if (!uncertain) attempt.current = null
        throw error
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reviewQueryKey(reviewId, userId) }),
  })
}

export const repositoryPullRequestsQueryKey = (repositoryId: string, userId: string | undefined) =>
  ['repository-pull-requests', userId, repositoryId] as const

/** Open PRs for a connected repo. A 401 drops cached `/me` so RequireAuth sends the user to login. */
export function useRepositoryPullRequestsQuery(repositoryId: string) {
  const queryClient = useQueryClient()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: repositoryPullRequestsQueryKey(repositoryId, userId),
    queryFn: async () => {
      try {
        return await fetchRepositoryPullRequests(repositoryId)
      } catch (error) {
        if (error instanceof PullRequestHttpError && error.status === 401) {
          await queryClient.resetQueries({ queryKey: meQueryKey })
        }
        throw error
      }
    },
    enabled: Boolean(userId),
  })
}

export const reviewQueryKey = (reviewId: string, userId: string | undefined) => ['review', userId, reviewId] as const
export const reviewDiffQueryKey = (reviewId: string, userId: string | undefined) =>
  ['review', userId, reviewId, 'diff'] as const
export const reviewFindingsQueryKey = (reviewId: string, userId: string | undefined) =>
  ['review', userId, reviewId, 'findings'] as const

export function useReviewQuery(reviewId: string) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: reviewQueryKey(reviewId, userId),
    queryFn: async ({ signal }) => {
      try {
        return await dataSource.getReview(reviewId)
      } catch (error) {
        await recheckReviewSession(queryClient, error, userId, signal)
        throw error
      }
    },
    enabled: Boolean(userId),
  })
}

/** PR берётся из ревью, поэтому запрос ждёт его загрузки. */
export function usePullRequestQuery(ref: { repositoryId: string; pullRequestNumber: number } | undefined) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['pull-request', userId, ref?.repositoryId, ref?.pullRequestNumber],
    queryFn: async ({ signal }) => {
      try {
        return ref ? await dataSource.getPullRequest(ref.repositoryId, ref.pullRequestNumber) : null
      } catch (error) {
        await recheckReviewSession(queryClient, error, userId, signal)
        throw error
      }
    },
    enabled: Boolean(userId) && ref !== undefined,
  })
}

export function useDiffQuery(reviewId: string) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: reviewDiffQueryKey(reviewId, userId),
    queryFn: async ({ signal }) => {
      try {
        return await dataSource.getDiff(reviewId)
      } catch (error) {
        await recheckReviewSession(queryClient, error, userId, signal)
        throw error
      }
    },
    enabled: Boolean(userId),
  })
}

export function useReviewCommentsQuery(reviewId: string) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: reviewFindingsQueryKey(reviewId, userId),
    queryFn: async ({ signal }) => {
      try {
        return await dataSource.getReviewComments(reviewId)
      } catch (error) {
        await recheckReviewSession(queryClient, error, userId, signal)
        throw error
      }
    },
    enabled: Boolean(userId),
  })
}
