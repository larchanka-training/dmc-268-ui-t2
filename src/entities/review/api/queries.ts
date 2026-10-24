import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { fetchReview } from '@/entities/review/api/review-client'
import { openReviewStream } from '@/entities/review/api/review-stream'
import { reviewRefetchIntervalMs, type ReviewTransport } from '@/entities/review/model/poll-delay'
import type { ReviewDetail, ReviewSnapshot } from '@/entities/review/model/types'
import { isReviewSettled } from '@/entities/review/model/types'
import { meQueryKey } from '@/entities/session'
import { ApiHttpError } from '@/shared/api/http'

export const reviewQueryKey = (reviewId: string) => ['reviews', reviewId] as const

function noRetryOnClientError(failureCount: number, error: Error): boolean {
  if (error instanceof ApiHttpError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 1
}

/** Drop cached `/me` so RequireAuth sends the user through OAuth and back to this review. */
async function fetchReviewGuarded(queryClient: QueryClient, reviewId: string) {
  try {
    return await fetchReview(reviewId)
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 401) {
      await queryClient.resetQueries({ queryKey: meQueryKey })
    }
    throw error
  }
}

function progressSignature(review: ReviewDetail | undefined): string {
  if (!review) {
    return ''
  }
  const { status, publicationStatus, progress } = review
  return `${status}|${publicationStatus}|${progress.completedChunks}/${progress.plannedChunks}`
}

function applySnapshot(queryClient: QueryClient, reviewId: string, snapshot: ReviewSnapshot) {
  const previous = queryClient.getQueryData<ReviewDetail>(reviewQueryKey(reviewId))
  if (previous && (previous.status !== snapshot.status || previous.publicationStatus !== snapshot.publicationStatus)) {
    queryClient.setQueryData<ReviewDetail>(reviewQueryKey(reviewId), {
      ...previous,
      status: snapshot.status,
      publicationStatus: snapshot.publicationStatus,
    })
  }
  // Snapshots carry no chunk progress/summary; refetch detail for the rest.
  void queryClient.invalidateQueries({ queryKey: reviewQueryKey(reviewId), exact: true })
}

/**
 * Review detail kept live without page reloads: SSE (`/events/stream`) first, plus detail
 * refetches during LLM analysis for chunk progress; when the stream is unusable, polling every
 * 3 s backing off to 15 s while nothing changes. TanStack pauses refetches in hidden tabs.
 * Everything stops once the review is settled.
 */
export function useLiveReview(reviewId: string) {
  const queryClient = useQueryClient()
  const [fallbackFor, setFallbackFor] = useState<string | null>(null)
  const transport: ReviewTransport = fallbackFor === reviewId ? 'polling' : 'stream'
  const unchangedPolls = useRef(0)
  const lastSignature = useRef<string | null>(null)

  const query = useQuery({
    queryKey: reviewQueryKey(reviewId),
    queryFn: () => fetchReviewGuarded(queryClient, reviewId),
    retry: noRetryOnClientError,
    refetchInterval: (current) => {
      const review = current.state.data
      return review ? reviewRefetchIntervalMs({ transport, review, unchangedPolls: unchangedPolls.current }) : false
    },
  })

  const signature = progressSignature(query.data)
  useEffect(() => {
    // Only polls count towards backoff; SSE-driven refetches must not slow the first polls down.
    const unchanged = transport === 'polling' && signature === lastSignature.current
    unchangedPolls.current = unchanged ? unchangedPolls.current + 1 : 0
    lastSignature.current = signature
  }, [signature, query.dataUpdatedAt, transport])

  const streamWanted = query.data !== undefined && !isReviewSettled(query.data) && transport === 'stream'
  useEffect(() => {
    if (!streamWanted) {
      return
    }
    return openReviewStream(reviewId, {
      onSnapshot: (snapshot) => applySnapshot(queryClient, reviewId, snapshot),
      onFallback: () => setFallbackFor(reviewId),
    })
  }, [streamWanted, reviewId, queryClient])

  return { query, transport }
}
