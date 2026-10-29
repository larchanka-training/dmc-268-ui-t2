import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'

export const reviewQueryKey = (reviewId: string) => ['review', reviewId] as const
export const reviewDiffQueryKey = (reviewId: string) => ['review', reviewId, 'diff'] as const
export const reviewFindingsQueryKey = (reviewId: string) => ['review', reviewId, 'findings'] as const

export function useReviewQuery(reviewId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: reviewQueryKey(reviewId),
    queryFn: () => dataSource.getReview(reviewId),
  })
}

/** PR берётся из ревью, поэтому запрос ждёт его загрузки. */
export function usePullRequestQuery(ref: { repositoryId: string; pullRequestNumber: number } | undefined) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: ['pull-request', ref?.repositoryId, ref?.pullRequestNumber],
    queryFn: () => (ref ? dataSource.getPullRequest(ref.repositoryId, ref.pullRequestNumber) : null),
    enabled: ref !== undefined,
  })
}

export function useDiffQuery(reviewId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: reviewDiffQueryKey(reviewId),
    queryFn: () => dataSource.getDiff(reviewId),
  })
}

export function useReviewCommentsQuery(reviewId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: reviewFindingsQueryKey(reviewId),
    queryFn: () => dataSource.getReviewComments(reviewId),
  })
}
