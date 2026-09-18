import { useQuery } from '@tanstack/react-query'
import { fetchMockComments } from '@/entities/comment/api/mock-data'

export function useCommentThreadsQuery(mrId: string) {
  return useQuery({
    queryKey: ['merge-request', mrId, 'comments'],
    queryFn: () => fetchMockComments(mrId),
  })
}
