import { parseDiff, type DiffFile, type DiffWire } from '@/entities/diff'
import { parseFinding, type FindingWire, type ReviewComment } from '@/entities/review-comment'
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
  type PullRequestWire,
  type Review,
  type ReviewDetailWire,
} from '@/entities/pull-request/model/types'

export class ReviewHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Review request failed (${status})`)
    this.name = 'ReviewHttpError'
    this.status = status
  }
}

/** OpenAPI `Limit` maximum. A cursor is valid only for the limit it was issued with. */
const PAGE_LIMIT = 100

interface PageWire<T> {
  items: T[]
  next_cursor: string | null
}

async function apiFetch(path: string): Promise<Response> {
  return fetch(path, { credentials: 'include' })
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new ReviewHttpError(response.status)
  return (await response.json()) as T
}

/** Обходит страницы, пока `visit` не вернёт true или не кончится `next_cursor`. */
async function walkPages<T>(path: string, visit: (items: T[]) => boolean | void): Promise<void> {
  let cursor: string | null = null
  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
    if (cursor !== null) params.set('cursor', cursor)
    const page: PageWire<T> = await readJson(await apiFetch(`${path}?${params.toString()}`))
    if (visit(page.items)) return
    cursor = page.next_cursor
  } while (cursor !== null)
}

export class ApiPullRequestDataSource implements PullRequestDataSource {
  async getReview(reviewId: string): Promise<Review> {
    const response = await apiFetch(reviewPath(reviewId))
    if (response.status === 404) throw new ReviewNotFoundError(reviewId)
    return parseReview(await readJson<ReviewDetailWire>(response))
  }

  async getPullRequest(repositoryId: string, number: number): Promise<PullRequest | null> {
    // Отдельного эндпоинта для одного PR нет: ищем среди открытых
    let found: PullRequest | null = null
    await walkPages<PullRequestWire>(repositoryPullRequestsPath(repositoryId), (items) => {
      const wire = items.find((item) => item.number === number)
      if (wire) found = parsePullRequest(wire)
      return found !== null
    })
    return found
  }

  async getDiff(reviewId: string): Promise<DiffFile[] | null> {
    const response = await apiFetch(reviewDiffPath(reviewId))
    if (response.status === 404) return null
    return parseDiff(await readJson<DiffWire>(response))
  }

  async getReviewComments(reviewId: string): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = []
    await walkPages<FindingWire>(reviewFindingsPath(reviewId), (items) => {
      comments.push(...items.map(parseFinding))
    })
    return comments
  }
}
