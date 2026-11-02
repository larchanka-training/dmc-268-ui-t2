import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meQueryKey, useMeQuery, type Me } from '@/entities/session'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'
import {
  fetchRepositoryPullRequests,
  PullRequestHttpError,
  startReview,
  type StartReviewInput,
} from '@/entities/pull-request/api/pull-request-client'

/** Starts a review for an open PR; resolves to the new review id. */
export function useStartReviewMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: StartReviewInput) => {
      const me = queryClient.getQueryData<Me>(meQueryKey)
      if (!me?.csrfToken) {
        throw new PullRequestHttpError(401, 'Missing CSRF token')
      }
      return startReview(input, me.csrfToken)
    },
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
  return useQuery({
    queryKey: reviewQueryKey(reviewId, userId),
    queryFn: () => dataSource.getReview(reviewId),
    enabled: Boolean(userId),
  })
}

/** PR берётся из ревью, поэтому запрос ждёт его загрузки. */
export function usePullRequestQuery(ref: { repositoryId: string; pullRequestNumber: number } | undefined) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: ['pull-request', userId, ref?.repositoryId, ref?.pullRequestNumber],
    queryFn: () => (ref ? dataSource.getPullRequest(ref.repositoryId, ref.pullRequestNumber) : null),
    enabled: Boolean(userId) && ref !== undefined,
  })
}

export function useDiffQuery(reviewId: string) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: reviewDiffQueryKey(reviewId, userId),
    queryFn: () => dataSource.getDiff(reviewId),
    enabled: Boolean(userId),
  })
}

export function useReviewCommentsQuery(reviewId: string) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: reviewFindingsQueryKey(reviewId, userId),
    queryFn: () => dataSource.getReviewComments(reviewId),
    enabled: Boolean(userId),
  })
}
