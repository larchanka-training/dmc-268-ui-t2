import { repositoryPullRequestReviewsPath, repositoryPullRequestsPath } from '@/entities/pull-request/model/paths'
import { parsePullRequest, type PullRequest, type PullRequestPageWire } from '@/entities/pull-request/model/types'

export class PullRequestHttpError extends Error {
  readonly status: number
  /** OpenAPI `Error.code`, e.g. `INTEGRATION_UNHEALTHY`. */
  readonly code?: string

  constructor(status: number, message?: string, code?: string) {
    super(message ?? `Pull request request failed (${status})`)
    this.name = 'PullRequestHttpError'
    this.status = status
    this.code = code
  }
}

/** Keep `code` and `message` from a failed response; tolerate non-JSON bodies. */
async function httpError(response: Response): Promise<PullRequestHttpError> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null) {
      const { code, message } = body as Record<string, unknown>
      return new PullRequestHttpError(
        response.status,
        typeof message === 'string' ? message : undefined,
        typeof code === 'string' ? code : undefined,
      )
    }
  } catch {
    // fall through to a status-only error
  }
  return new PullRequestHttpError(response.status)
}

/** OpenAPI `Limit` default. A cursor is valid only for the limit it was issued with. */
const PAGE_LIMIT = 20

/** Open PRs of a connected repository (API reads GitHub with the user's token). Follows `next_cursor`. */
export async function fetchRepositoryPullRequests(repositoryId: string): Promise<PullRequest[]> {
  const items: PullRequest[] = []
  let cursor: string | null = null
  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
    if (cursor !== null) {
      params.set('cursor', cursor)
    }
    const response = await fetch(`${repositoryPullRequestsPath(repositoryId)}?${params.toString()}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new PullRequestHttpError(response.status)
    }
    const page = (await response.json()) as PullRequestPageWire
    items.push(...page.items.map(parsePullRequest))
    cursor = page.next_cursor
  } while (cursor !== null)
  return items
}

export interface StartReviewInput {
  repositoryId: string
  number: number
  headSha: string
}

/** OpenAPI `startReview`: 202 new run, 200 same-key replay. Returns the review id. */
export async function startReview(input: StartReviewInput, csrfToken: string): Promise<string> {
  const response = await fetch(repositoryPullRequestReviewsPath(input.repositoryId, input.number), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ requested_head_sha: input.headSha }),
  })
  if (!response.ok) {
    throw await httpError(response)
  }
  const wire = (await response.json()) as { review_id: string }
  return wire.review_id
}
