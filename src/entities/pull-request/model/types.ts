/** OpenAPI `ReviewStatus`. */
export type ReviewStatus =
  'QUEUED' | 'FETCHING_DIFF' | 'PARSING_CONTEXT' | 'LLM_PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

/** OpenAPI `PublicationStatus`, независим от статуса анализа. */
export type PublicationStatus = 'NOT_READY' | 'PENDING' | 'PUBLISHED' | 'PARTIAL' | 'FAILED' | 'UNKNOWN' | 'SKIPPED'

/** OpenAPI `ReasonCode`. */
export type ReviewReasonCode =
  | 'QUEUE_DEADLINE_EXCEEDED'
  | 'VCS_RATE_LIMITED'
  | 'VCS_UNAVAILABLE'
  | 'VCS_ACCESS_DENIED'
  | 'PR_STALE_OR_CLOSED'
  | 'DIFF_UNTRUSTWORTHY'
  | 'SOURCE_BLOB_UNAVAILABLE'
  | 'AST_PARSE_FAILED'
  | 'LLM_TIMEOUT'
  | 'LLM_UNAVAILABLE'
  | 'LLM_OUTPUT_INVALID'
  | 'ANALYSIS_DEADLINE_EXCEEDED'

/** Открытый PR у провайдера (OpenAPI `PullRequest`). */
export interface PullRequest {
  number: number
  title: string
  author: { login: string }
  sourceBranch: string
  targetBranch: string
  headSha: string
}

/** Запуск ревью (OpenAPI `ReviewDetail`). */
export interface Review {
  /** Opaque ID */
  id: string
  repositoryId: string
  pullRequestNumber: number
  status: ReviewStatus
  publicationStatus: PublicationStatus
  requestedHeadSha: string
  summary: string | null
  progress: { completedChunks: number; plannedChunks: number }
  /** UTC ISO 8601 */
  createdAt: string
  /** UTC ISO 8601 */
  startedAt: string | null
  /** UTC ISO 8601 */
  finishedAt: string | null
  error: { reasonCode: ReviewReasonCode; retryable: boolean; retryAt: string | null } | null
}

/** OpenAPI `PullRequestRef`. */
export interface PullRequestRefWire {
  repository_external_id: string
  ref: string
  sha: string
}

/** OpenAPI `PullRequest` JSON. */
export interface PullRequestWire {
  number: number
  title: string
  author: { login: string }
  state: 'OPEN'
  source: PullRequestRefWire
  base: PullRequestRefWire
}

export interface PullRequestPageWire {
  items: PullRequestWire[]
  next_cursor: string | null
}

export interface LineRangeWire {
  start_line: number
  end_line: number
}

/** OpenAPI `Coverage`. */
export interface CoverageWire {
  included: { path: string; ranges: LineRangeWire[] }[]
  skipped: {
    path: string
    ranges: LineRangeWire[]
    reason:
      | 'policy'
      | 'unsupported_language'
      | 'unavailable_blob'
      | 'provider_truncated'
      | 'token_budget'
      | 'file_limit'
      | 'line_limit'
      | 'context_error'
  }[]
  context_quality: 'full' | 'degraded' | 'diff_only'
}

/** OpenAPI `ReviewDetail` JSON. */
export interface ReviewDetailWire {
  id: string
  repository_id: string
  pull_request_number: number
  status: ReviewStatus
  requested_head_sha: string
  snapshot: { base_sha: string; merge_base_sha: string; head_sha: string; captured_at: string } | null
  progress: { completed_chunks: number; planned_chunks: number }
  summary: string | null
  coverage: CoverageWire | null
  usage: { input_tokens: number; output_tokens: number } | null
  publication_status: PublicationStatus
  created_at: string
  started_at: string | null
  finished_at: string | null
  retry_at: string | null
  error: { reason_code: ReviewReasonCode; retryable: boolean; retry_at: string | null } | null
}

export function parsePullRequest(wire: PullRequestWire): PullRequest {
  return {
    number: wire.number,
    title: wire.title,
    author: { login: wire.author.login },
    sourceBranch: wire.source.ref,
    targetBranch: wire.base.ref,
    headSha: wire.source.sha,
  }
}

export function parseReview(wire: ReviewDetailWire): Review {
  return {
    id: wire.id,
    repositoryId: wire.repository_id,
    pullRequestNumber: wire.pull_request_number,
    status: wire.status,
    publicationStatus: wire.publication_status,
    requestedHeadSha: wire.requested_head_sha,
    summary: wire.summary,
    progress: {
      completedChunks: wire.progress.completed_chunks,
      plannedChunks: wire.progress.planned_chunks,
    },
    createdAt: wire.created_at,
    startedAt: wire.started_at,
    finishedAt: wire.finished_at,
    error: wire.error && {
      reasonCode: wire.error.reason_code,
      retryable: wire.error.retryable,
      retryAt: wire.error.retry_at,
    },
  }
}
