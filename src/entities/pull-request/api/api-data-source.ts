import type { DiffFile } from '@/entities/diff'
import type { ReviewComment } from '@/entities/review-comment'
import type { PullRequestDataSource } from '@/entities/pull-request/api/data-source'
import { openReviewStream, type ReviewStreamHandlers } from '@/entities/pull-request/api/review-stream'
import type { PullRequest, Review } from '@/entities/pull-request/model/types'
import { NonRetryableError } from '@/shared/lib/non-retryable-error'

export class NotImplementedError extends NonRetryableError {
  constructor(method: string) {
    super(`${method} is not implemented`)
    this.name = 'NotImplementedError'
  }
}

/** Реальный API пока не подключён: все методы сразу отвечают «не реализовано», без сетевых запросов. */
export class ApiPullRequestDataSource implements PullRequestDataSource {
  getReview(): Promise<Review> {
    return Promise.reject(new NotImplementedError('getReview'))
  }

  getPullRequest(): Promise<PullRequest | null> {
    return Promise.reject(new NotImplementedError('getPullRequest'))
  }

  getDiff(): Promise<DiffFile[] | null> {
    return Promise.reject(new NotImplementedError('getDiff'))
  }

  getReviewComments(): Promise<ReviewComment[]> {
    return Promise.reject(new NotImplementedError('getReviewComments'))
  }

  subscribeReview(reviewId: string, handlers: ReviewStreamHandlers): () => void {
    return openReviewStream(reviewId, handlers)
  }
}
