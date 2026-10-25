import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'

export function useReviewQuery(reviewId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: ['review', reviewId],
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
    queryKey: ['review', reviewId, 'diff'],
    queryFn: () => dataSource.getDiff(reviewId),
  })
}

export function useReviewCommentsQuery(reviewId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: ['review', reviewId, 'findings'],
    queryFn: () => dataSource.getReviewComments(reviewId),
  })
}
