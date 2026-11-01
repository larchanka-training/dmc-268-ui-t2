import type { ReviewSnapshot } from '@/entities/pull-request/model/review-snapshot'
import { isReviewSettled } from '@/entities/pull-request/model/review-snapshot'

const BASE_POLL_MS = 3000
const MAX_POLL_MS = 15000

/** SYSTEM_DESIGN §11: poll every 3 s, backing off to 15 s while nothing changes. */
export function nextPollDelayMs(unchangedPolls: number): number {
  return Math.min(BASE_POLL_MS * 2 ** unchangedPolls, MAX_POLL_MS)
}

const CHUNK_PROGRESS_POLL_MS = 5000

export type ReviewTransport = 'stream' | 'polling'

export interface ReviewRefetchInput {
  transport: ReviewTransport
  review: Pick<ReviewSnapshot, 'status' | 'publicationStatus'>
  unchangedPolls: number
}

/** How often to refetch review detail, or `false` to rely on SSE alone. */
export function reviewRefetchIntervalMs({ transport, review, unchangedPolls }: ReviewRefetchInput): number | false {
  if (isReviewSettled(review)) {
    return false
  }
  if (transport === 'polling') {
    return nextPollDelayMs(unchangedPolls)
  }
  // Snapshots carry no chunk counts, so LLM progress needs detail refetches even over SSE.
  return review.status === 'LLM_PROCESSING' ? CHUNK_PROGRESS_POLL_MS : false
}

export interface PollTracker {
  signature: string | null
  updatedAt: number
  unchangedPolls: number
}

export const INITIAL_POLL_TRACKER: PollTracker = { signature: null, updatedAt: -1, unchangedPolls: 0 }

/**
 * Counts unchanged polling responses. Called once per fetched response (deduped by `updatedAt`, since
 * TanStack may re-evaluate the interval for the same data) and before the next delay is computed.
 */
export function trackPoll(
  tracker: PollTracker,
  response: { signature: string; updatedAt: number; transport: ReviewTransport },
): PollTracker {
  if (response.updatedAt === tracker.updatedAt) {
    return tracker
  }
  // Only polls count towards backoff; SSE-driven refetches must not slow the first polls down.
  const unchanged = response.transport === 'polling' && response.signature === tracker.signature
  return {
    signature: response.signature,
    updatedAt: response.updatedAt,
    unchangedPolls: unchanged ? tracker.unchangedPolls + 1 : 0,
  }
}
