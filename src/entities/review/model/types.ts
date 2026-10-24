/** OpenAPI `ReviewStatus`: one canonical lifecycle field, no public `stage`. */
export type ReviewStatus =
  'QUEUED' | 'FETCHING_DIFF' | 'PARSING_CONTEXT' | 'LLM_PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

/** OpenAPI `PublicationStatus`. */
export type PublicationStatus = 'NOT_READY' | 'PENDING' | 'PUBLISHED' | 'PARTIAL' | 'FAILED' | 'UNKNOWN' | 'SKIPPED'

/** SSE `review.snapshot` payload (OpenAPI `ReviewStreamSnapshot`). */
export interface ReviewSnapshotWire {
  schema_version: 1
  review_id: string
  sequence: number
  status: ReviewStatus
  publication_status: PublicationStatus
}

export interface ReviewSnapshot {
  sequence: number
  status: ReviewStatus
  publicationStatus: PublicationStatus
}

export function parseReviewSnapshot(wire: ReviewSnapshotWire): ReviewSnapshot {
  return {
    sequence: wire.sequence,
    status: wire.status,
    publicationStatus: wire.publication_status,
  }
}

const TERMINAL_STATUSES: ReadonlySet<ReviewStatus> = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED'])

/**
 * Nothing more will change for this review: terminal analysis with settled publication,
 * or FAILED/SKIPPED analysis that never reached publication (same rule the SSE endpoint closes on).
 */
export function isReviewSettled({ status, publicationStatus }: Pick<ReviewSnapshot, 'status' | 'publicationStatus'>) {
  if (!TERMINAL_STATUSES.has(status)) {
    return false
  }
  if (publicationStatus !== 'NOT_READY' && publicationStatus !== 'PENDING') {
    return true
  }
  return (status === 'FAILED' || status === 'SKIPPED') && publicationStatus === 'NOT_READY'
}

/** Subset of OpenAPI `ReviewDetail` the review screen reads. */
export interface ReviewDetailWire {
  id: string
  pull_request_number: number
  status: ReviewStatus
  publication_status: PublicationStatus
  progress: { completed_chunks: number; planned_chunks: number }
  summary: string | null
}

export interface ReviewDetail {
  id: string
  pullRequestNumber: number
  status: ReviewStatus
  publicationStatus: PublicationStatus
  progress: { completedChunks: number; plannedChunks: number }
  summary: string | null
}

export function parseReviewDetail(wire: ReviewDetailWire): ReviewDetail {
  return {
    id: wire.id,
    pullRequestNumber: wire.pull_request_number,
    status: wire.status,
    publicationStatus: wire.publication_status,
    progress: {
      completedChunks: wire.progress.completed_chunks,
      plannedChunks: wire.progress.planned_chunks,
    },
    summary: wire.summary,
  }
}
