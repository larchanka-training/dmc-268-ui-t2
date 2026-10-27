import { parseDiff, type DiffFile } from '@/entities/diff'
import { parseFinding, type ReviewComment } from '@/entities/review-comment'
import { ReviewNotFoundError, type PullRequestDataSource } from '@/entities/pull-request/api/data-source'
import { MOCK_PULL_REQUESTS, MOCK_REPOSITORY_ID, MOCK_REVIEWS } from '@/entities/pull-request/fixtures/reviews'
import { parsePullRequest, parseReview, type PullRequest, type Review } from '@/entities/pull-request/model/types'

export interface MockPullRequestDataSourceOptions {
  /** Искусственная задержка, чтобы видеть loading-состояния. По умолчанию 300 мс. */
  latencyMs?: number
}

/** Отдаёт wire-фикстуры через те же parse-функции, что и ApiPullRequestDataSource. */
export class MockPullRequestDataSource implements PullRequestDataSource {
  private readonly latencyMs: number

  constructor({ latencyMs = 300 }: MockPullRequestDataSourceOptions = {}) {
    this.latencyMs = latencyMs
  }

  async getReview(reviewId: string): Promise<Review> {
    return parseReview((await this.find(reviewId)).review)
  }

  async getPullRequest(repositoryId: string, number: number): Promise<PullRequest | null> {
    await this.delay()
    if (repositoryId !== MOCK_REPOSITORY_ID) return null
    const wire = MOCK_PULL_REQUESTS.find((item) => item.number === number)
    return wire ? parsePullRequest(wire) : null
  }

  async getDiff(reviewId: string): Promise<DiffFile[] | null> {
    const { diff } = await this.find(reviewId)
    return diff && parseDiff(diff)
  }

  async getReviewComments(reviewId: string): Promise<ReviewComment[]> {
    return (await this.find(reviewId)).findings.map(parseFinding)
  }

  private delay() {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs))
  }

  private async find(reviewId: string) {
    await this.delay()
    const fixture = MOCK_REVIEWS[reviewId]
    if (!fixture) throw new ReviewNotFoundError(reviewId)
    return fixture
  }
}
