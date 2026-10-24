import type { ReviewComment } from '@/entities/review-comment'
import type { PullRequestDataSource } from '@/entities/pull-request/api/data-source'
import type { PullRequest } from '@/entities/pull-request/model/types'

/**
 * Заготовка под реальный backend. Запросов пока нет.
 *
 * TODO: внедрить HTTP-клиент и реализовать методы:
 *  - GET {baseUrl}/pulls/:id            → PullRequest (404 → PullRequestNotFoundError)
 *  - GET {baseUrl}/pulls/:id/diff       → text/plain, сырой unified diff
 *  - GET {baseUrl}/pulls/:id/comments   → ReviewComment[]
 * Остальной код (хуки, страница) менять не нужно: он зависит только от PullRequestDataSource.
 */
export class ApiPullRequestDataSource implements PullRequestDataSource {
  constructor(private readonly baseUrl: string = '/api') {}

  getPullRequest(id: string): Promise<PullRequest> {
    return Promise.resolve(`${this.baseUrl}/v1/repositories/${id}/pull-requests` as unknown as PullRequest)
  }

  getDiff(id: string): Promise<string> {
    return Promise.resolve(`${this.baseUrl}/v1/reviews/${id}/diff`)
  }

  getReviewComments(id: string): Promise<ReviewComment[]> {
    return Promise.resolve(`${this.baseUrl}/v1/reviews/${id}/findings` as unknown as ReviewComment[])
  }
}
