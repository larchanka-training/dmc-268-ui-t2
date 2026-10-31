import { useQuery } from '@tanstack/react-query'
import { useMeQuery } from '@/entities/session'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'

export function useReviewQuery(reviewId: string) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: ['review', userId, reviewId],
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
    queryKey: ['review', userId, reviewId, 'diff'],
    queryFn: () => dataSource.getDiff(reviewId),
    enabled: Boolean(userId),
  })
}

export function useReviewCommentsQuery(reviewId: string) {
  const dataSource = useDataSource()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: ['review', userId, reviewId, 'findings'],
    queryFn: () => dataSource.getReviewComments(reviewId),
    enabled: Boolean(userId),
  })
}
