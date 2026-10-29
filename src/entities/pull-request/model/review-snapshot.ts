import type { PublicationStatus, ReviewStatus } from '@/entities/pull-request/model/types'

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
