import type { ReviewComment } from '@/entities/review-comment'
import { PullRequestNotFoundError, type PullRequestDataSource } from '@/entities/pull-request/api/data-source'
import { MOCK_PULL_REQUESTS } from '@/entities/pull-request/fixtures/pull-requests'
import type { PullRequest } from '@/entities/pull-request/model/types'

export interface MockPullRequestDataSourceOptions {
  /** Искусственная задержка, чтобы видеть loading-состояния. По умолчанию 300 мс. */
  latencyMs?: number
}

export class MockPullRequestDataSource implements PullRequestDataSource {
  private readonly latencyMs: number

  constructor({ latencyMs = 300 }: MockPullRequestDataSourceOptions = {}) {
    this.latencyMs = latencyMs
  }

  async getPullRequest(id: string): Promise<PullRequest> {
    return (await this.find(id)).pullRequest
  }

  async getDiff(id: string): Promise<string> {
    return (await this.find(id)).diff
  }

  async getReviewComments(id: string): Promise<ReviewComment[]> {
    return (await this.find(id)).comments
  }

  private async find(id: string) {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs))
    const fixture = MOCK_PULL_REQUESTS[id]
    if (!fixture) throw new PullRequestNotFoundError(id)
    return fixture
  }
}
