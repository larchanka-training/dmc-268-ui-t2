import { useQuery } from '@tanstack/react-query'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'

export function usePullRequestQuery(prId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: ['pull-request', prId],
    queryFn: () => dataSource.getPullRequest(prId),
  })
}

export function useDiffQuery(prId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: ['pull-request', prId, 'diff'],
    queryFn: () => dataSource.getDiff(prId),
  })
}

export function useReviewCommentsQuery(prId: string) {
  const dataSource = useDataSource()
  return useQuery({
    queryKey: ['pull-request', prId, 'review-comments'],
    queryFn: () => dataSource.getReviewComments(prId),
  })
}
