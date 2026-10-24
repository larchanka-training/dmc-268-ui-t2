/** SYSTEM_DESIGN §4: `ReviewJob.status`. */
export type ReviewStatus =
  'QUEUED' | 'FETCHING_DIFF' | 'PARSING_CONTEXT' | 'LLM_PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

/** SYSTEM_DESIGN §4: `publication_status`, независим от статуса анализа. */
export type PublicationStatus = 'NOT_READY' | 'PENDING' | 'PUBLISHED' | 'PARTIAL' | 'FAILED' | 'UNKNOWN' | 'SKIPPED'

export interface PullRequestAuthor {
  name: string
  avatarUrl?: string
}

export interface PullRequest {
  /** Opaque ID */
  id: string
  number: number
  title: string
  author: PullRequestAuthor
  sourceBranch: string
  targetBranch: string
  /** UTC ISO 8601 */
  createdAt: string
  /** UTC ISO 8601 */
  updatedAt: string
  reviewStatus: ReviewStatus
  publicationStatus: PublicationStatus
}
