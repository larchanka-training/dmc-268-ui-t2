import type { PublicationStatus, ReviewStatus } from '@/entities/review/model/types'

export type ReviewStageId = 'context' | 'analysis' | 'publication'

export type ReviewStageState = 'pending' | 'active' | 'done' | 'partial' | 'failed' | 'skipped'

export interface ReviewStage {
  id: ReviewStageId
  state: ReviewStageState
}

export interface ReviewStagesInput {
  status: ReviewStatus
  publicationStatus: PublicationStatus
  /** `progress.planned_chunks` from review detail. */
  plannedChunks: number
}

const CONTEXT_STATUSES: ReadonlySet<ReviewStatus> = new Set(['QUEUED', 'FETCHING_DIFF', 'PARSING_CONTEXT'])

function publicationState(publicationStatus: PublicationStatus): ReviewStageState {
  switch (publicationStatus) {
    case 'PUBLISHED':
      return 'done'
    case 'PARTIAL':
      return 'partial'
    case 'FAILED':
    case 'UNKNOWN':
      return 'failed'
    default:
      return 'active'
  }
}

/** Projects backend status onto the three UI steps: context → LLM analysis → publication. */
export function getReviewStages({ status, publicationStatus, plannedChunks }: ReviewStagesInput): ReviewStage[] {
  if (CONTEXT_STATUSES.has(status)) {
    return [
      { id: 'context', state: 'active' },
      { id: 'analysis', state: 'pending' },
      { id: 'publication', state: 'pending' },
    ]
  }
  if (status === 'COMPLETED' || status === 'PARTIAL') {
    return [
      { id: 'context', state: 'done' },
      { id: 'analysis', state: status === 'PARTIAL' ? 'partial' : 'done' },
      { id: 'publication', state: publicationState(publicationStatus) },
    ]
  }
  if (status === 'FAILED' && plannedChunks === 0) {
    return [
      { id: 'context', state: 'failed' },
      { id: 'analysis', state: 'skipped' },
      { id: 'publication', state: 'skipped' },
    ]
  }
  if (status === 'FAILED') {
    return [
      { id: 'context', state: 'done' },
      { id: 'analysis', state: 'failed' },
      { id: 'publication', state: 'skipped' },
    ]
  }
  if (status === 'LLM_PROCESSING') {
    return [
      { id: 'context', state: 'done' },
      { id: 'analysis', state: 'active' },
      { id: 'publication', state: 'pending' },
    ]
  }
  return [
    { id: 'context', state: 'skipped' },
    { id: 'analysis', state: 'skipped' },
    { id: 'publication', state: 'skipped' },
  ]
}
