import type { ReviewComment } from '@/entities/review-comment'
import type { PullRequest } from '@/entities/pull-request/model/types'
import { NonRetryableError } from '@/shared/lib/non-retryable-error'

export interface PullRequestDataSource {
  getPullRequest(id: string): Promise<PullRequest>
  /** Сырой unified diff (формат `git diff`) */
  getDiff(id: string): Promise<string>
  getReviewComments(id: string): Promise<ReviewComment[]>
}

export class PullRequestNotFoundError extends NonRetryableError {
  constructor(id: string) {
    super(`Pull request ${id} not found`)
    this.name = 'PullRequestNotFoundError'
  }
}
