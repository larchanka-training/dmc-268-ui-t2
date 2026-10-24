import type { ReviewSnapshot } from '@/entities/review/model/types'
import { isReviewSettled } from '@/entities/review/model/types'

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
