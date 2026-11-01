import { useQuery } from '@tanstack/react-query'
import { useMeQuery } from '@/entities/session'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'

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
