import { useQuery } from '@tanstack/react-query'
import { fetchReviewDiff } from '@/entities/diff/api/diff-client'
import { fetchMockContext } from '@/entities/diff/api/mock-data'
import { ApiHttpError } from '@/shared/api/http'

export const reviewDiffQueryKey = (reviewId: string) => ['reviews', reviewId, 'diff'] as const

/** 404 = not captured yet, 410 = context expired: neither improves on retry. */
function noRetryOnClientError(failureCount: number, error: Error): boolean {
  if (error instanceof ApiHttpError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 1
}

/** The stored diff exists once the backend has fetched it; enable the query then. */
export function useReviewDiffQuery(reviewId: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: reviewDiffQueryKey(reviewId),
    queryFn: () => fetchReviewDiff(reviewId),
    enabled,
    retry: noRetryOnClientError,
  })
}

export function useDiffContextQuery(
  filePath: string,
  hunkId: string,
  direction: 'before' | 'after',
  startLine: number,
  lineCount: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['merge-request', 'diff', filePath, hunkId, 'context', direction, startLine, lineCount],
    queryFn: () => fetchMockContext(startLine, lineCount),
    enabled,
  })
}
