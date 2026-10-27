import type { DiffFile } from '@/entities/diff'
import type { ReviewComment } from '@/entities/review-comment'
import type { PullRequest, Review } from '@/entities/pull-request/model/types'
import { NonRetryableError } from '@/shared/lib/non-retryable-error'

/** Источник данных страницы ревью; отдаёт уже распарсенные UI-модели. */
export interface PullRequestDataSource {
  /** `GET /reviews/{id}`; 404 → ReviewNotFoundError */
  getReview(reviewId: string): Promise<Review>
  /** Поиск по `GET /repositories/{id}/pull-requests`; null — PR уже не открыт */
  getPullRequest(repositoryId: string, number: number): Promise<PullRequest | null>
  /** `GET /reviews/{id}/diff`; null — diff ещё не сохранён (404) */
  getDiff(reviewId: string): Promise<DiffFile[] | null>
  /** Все страницы `GET /reviews/{id}/findings` */
  getReviewComments(reviewId: string): Promise<ReviewComment[]>
}

export class ReviewNotFoundError extends NonRetryableError {
  constructor(id: string) {
    super(`Review ${id} not found`)
    this.name = 'ReviewNotFoundError'
  }
}
