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
    return Promise.reject(this.notImplemented(`GET ${this.baseUrl}/pulls/${id}`))
  }

  getDiff(id: string): Promise<string> {
    return Promise.reject(this.notImplemented(`GET ${this.baseUrl}/pulls/${id}/diff`))
  }

  getReviewComments(id: string): Promise<ReviewComment[]> {
    return Promise.reject(this.notImplemented(`GET ${this.baseUrl}/pulls/${id}/comments`))
  }

  private notImplemented(request: string) {
    return new Error(`ApiPullRequestDataSource is not implemented yet (${request})`)
  }
}
