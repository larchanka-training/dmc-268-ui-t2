import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDataSource } from '@/entities/pull-request/api/data-source-context'
import { reviewDiffQueryKey, reviewFindingsQueryKey, reviewQueryKey } from '@/entities/pull-request/api/queries'
import {
  INITIAL_POLL_TRACKER,
  reviewRefetchIntervalMs,
  trackPoll,
  type ReviewTransport,
} from '@/entities/pull-request/model/poll-delay'
import { isReviewSettled, type ReviewSnapshot } from '@/entities/pull-request/model/review-snapshot'
import type { Review } from '@/entities/pull-request/model/types'

function progressSignature(review: Review): string {
  const { status, publicationStatus, progress } = review
  return `${status}|${publicationStatus}|${progress.completedChunks}/${progress.plannedChunks}`
}

function applySnapshot(queryClient: QueryClient, reviewId: string, snapshot: ReviewSnapshot) {
  const previous = queryClient.getQueryData<Review>(reviewQueryKey(reviewId))
  if (previous && (previous.status !== snapshot.status || previous.publicationStatus !== snapshot.publicationStatus)) {
    queryClient.setQueryData<Review>(reviewQueryKey(reviewId), {
      ...previous,
      status: snapshot.status,
      publicationStatus: snapshot.publicationStatus,
    })
  }
  // Snapshots carry no chunk progress/summary; refetch detail for the rest.
  void queryClient.invalidateQueries({ queryKey: reviewQueryKey(reviewId), exact: true })
}

/**
 * Review detail kept live without page reloads: the data source's stream (SSE) first, plus detail
 * refetches during LLM analysis for chunk progress; when the stream is unusable, polling every
 * 3 s backing off to 15 s while nothing changes. TanStack pauses refetches in hidden tabs.
 * Everything stops once the review is settled. A status change also refreshes diff and findings.
 */
export function useLiveReview(reviewId: string) {
  const dataSource = useDataSource()
  const queryClient = useQueryClient()
  const [fallbackFor, setFallbackFor] = useState<string | null>(null)
  const transport: ReviewTransport = fallbackFor === reviewId ? 'polling' : 'stream'
  const pollTracker = useRef(INITIAL_POLL_TRACKER)

  const query = useQuery({
    queryKey: reviewQueryKey(reviewId),
    queryFn: () => dataSource.getReview(reviewId),
    refetchInterval: (current) => {
      const review = current.state.data
      if (!review) {
        return false
      }
      // Count the response before computing the delay, so the first unchanged poll already backs off.
      pollTracker.current = trackPoll(pollTracker.current, {
        signature: progressSignature(review),
        updatedAt: current.state.dataUpdatedAt,
        transport,
      })
      return reviewRefetchIntervalMs({ transport, review, unchangedPolls: pollTracker.current.unchangedPolls })
    },
  })

  // The diff is stored and findings appear only at later statuses; refetch them when the status moves on.
  const status = query.data?.status
  const previousStatus = useRef(status)
  useEffect(() => {
    if (previousStatus.current !== undefined && status !== previousStatus.current) {
      void queryClient.invalidateQueries({ queryKey: reviewDiffQueryKey(reviewId) })
      void queryClient.invalidateQueries({ queryKey: reviewFindingsQueryKey(reviewId) })
    }
    previousStatus.current = status
  }, [status, reviewId, queryClient])

  const streamWanted = query.data !== undefined && !isReviewSettled(query.data) && transport === 'stream'
  useEffect(() => {
    if (!streamWanted) {
      return
    }
    return dataSource.subscribeReview(reviewId, {
      onSnapshot: (snapshot) => applySnapshot(queryClient, reviewId, snapshot),
      onFallback: () => setFallbackFor(reviewId),
    })
  }, [streamWanted, reviewId, queryClient, dataSource])

  return { query, transport }
}
