import { useQuery } from '@tanstack/react-query'
import { fetchReviewFindings } from '@/entities/finding/api/finding-client'

export const reviewFindingsQueryKey = (reviewId: string) => ['reviews', reviewId, 'findings'] as const

/** Findings exist only once analysis has finished; enable the query then. */
export function useReviewFindingsQuery(reviewId: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: reviewFindingsQueryKey(reviewId),
    queryFn: () => fetchReviewFindings(reviewId),
    enabled,
  })
}
