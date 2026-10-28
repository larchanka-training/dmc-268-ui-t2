import { parseDiff, type DiffFile, type DiffWire } from '@/entities/diff'
import { parseFinding, type FindingPageWire, type ReviewComment } from '@/entities/review-comment'
import { ReviewNotFoundError, type PullRequestDataSource } from '@/entities/pull-request/api/data-source'
import {
  repositoryPullRequestsPath,
  reviewDiffPath,
  reviewFindingsPath,
  reviewPath,
} from '@/entities/pull-request/model/paths'
import {
  parsePullRequest,
  parseReview,
  type PullRequest,
  type PullRequestPageWire,
  type Review,
  type ReviewDetailWire,
} from '@/entities/pull-request/model/types'
import { NonRetryableError } from '@/shared/lib/non-retryable-error'

export class NotImplementedError extends NonRetryableError {
  constructor(method: string) {
    super(`${method} is not implemented`)
    this.name = 'NotImplementedError'
  }
}

export class ReviewHttpError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Review request failed (${status})`)
    this.name = 'ReviewHttpError'
    this.status = status
  }
}

/** OpenAPI `Limit` default. A cursor is valid only for the limit it was issued with. */
const PAGE_LIMIT = 20

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
  })
}

function pageUrl(path: string, cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
  if (cursor !== null) {
    params.set('cursor', cursor)
  }
  return `${path}?${params.toString()}`
}

/** HTTP client for review reads — same pattern as `repository-client` / `session-client`. */
export class ApiPullRequestDataSource implements PullRequestDataSource {
  async getReview(reviewId: string): Promise<Review> {
    const response = await apiFetch(reviewPath(reviewId))
    if (response.status === 404) {
      throw new ReviewNotFoundError(reviewId)
    }
    if (!response.ok) {
      throw new ReviewHttpError(response.status)
    }
    const wire = (await response.json()) as ReviewDetailWire
    return parseReview(wire)
  }

  async getPullRequest(repositoryId: string, number: number): Promise<PullRequest | null> {
    let cursor: string | null = null
    do {
      const response = await apiFetch(pageUrl(repositoryPullRequestsPath(repositoryId), cursor))
      if (!response.ok) {
        throw new ReviewHttpError(response.status)
      }
      const page = (await response.json()) as PullRequestPageWire
      const match = page.items.find((item) => item.number === number)
      if (match) {
        return parsePullRequest(match)
      }
      cursor = page.next_cursor
    } while (cursor !== null)
    return null
  }

  async getDiff(reviewId: string): Promise<DiffFile[] | null> {
    const response = await apiFetch(reviewDiffPath(reviewId))
    if (response.status === 404 || response.status === 410) {
      return null
    }
    if (!response.ok) {
      throw new ReviewHttpError(response.status)
    }
    const wire = (await response.json()) as DiffWire
    return parseDiff(wire)
  }

  async getReviewComments(reviewId: string): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = []
    let cursor: string | null = null
    do {
      const response = await apiFetch(pageUrl(reviewFindingsPath(reviewId), cursor))
      if (!response.ok) {
        throw new ReviewHttpError(response.status)
      }
      const page = (await response.json()) as FindingPageWire
      comments.push(...page.items.map(parseFinding))
      cursor = page.next_cursor
    } while (cursor !== null)
    return comments
  }
}
