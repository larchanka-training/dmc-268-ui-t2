import { useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { repositoryDisplayName, useConnectedRepositoriesQuery, type Repository } from '@/entities/repository'
import { type AuditReview } from '@/entities/repository-insights'
import { meQueryKey, useMeQuery } from '@/entities/session'
import { PUBLICATION_LABEL, STATUS_LABEL } from '@/widgets/pr-header/model/labels'
import type { PublicationStatus, ReviewStatus } from '@/entities/pull-request'
import { Button } from '@/shared/ui/button'

async function fetchReviewWindow(repositoryId: string, client: QueryClient): Promise<AuditReview[]> {
  const items: AuditReview[] = []
  const requestedCursors = new Set<string>()
  let cursor: string | null = null
  do {
    if (cursor !== null) {
      if (requestedCursors.has(cursor)) break
      requestedCursors.add(cursor)
    }
    const params = new URLSearchParams({ days: '30' })
    if (cursor) params.set('cursor', cursor)
    const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/reviews?${params}`, {
      credentials: 'include',
    })
    if (response.status === 401) await client.resetQueries({ queryKey: meQueryKey })
    if (!response.ok) throw new Error(`Could not load reviews (${response.status})`)
    const page = (await response.json()) as { items: AuditReview[]; next_cursor: string | null }
    items.push(...page.items)
    cursor = page.next_cursor
  } while (cursor)
  return items
}

export function ReviewsPage() {
  const client = useQueryClient()
  const userId = useMeQuery().data?.user.id
  const reposQuery = useConnectedRepositoriesQuery()
  const repos = reposQuery.data ?? []
  const reviewQueries = useQueries({
    queries: repos.map((repo) => ({
      queryKey: ['reviews-finder', userId, repo.id],
      queryFn: () => fetchReviewWindow(repo.id, client),
      enabled: Boolean(repo.id && userId),
    })),
  })

  if (reposQuery.isPending || reviewQueries.some((query) => query.isPending)) {
    return <p className="text-sm text-muted-foreground">Loading reviews…</p>
  }

  if (reposQuery.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Could not load reviews.
      </p>
    )
  }
  if (reviewQueries.length > 0 && reviewQueries.every((query) => query.isError)) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Could not load reviews.
      </p>
    )
  }

  if (repos.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-foreground">Reviews</h1>
        <p className="text-sm text-muted-foreground">No repositories connected yet.</p>
        <Link className="text-sm text-primary underline" to="/repos/connect">
          Connect repository
        </Link>
      </div>
    )
  }

  const failedRepos = repos.filter((_, index) => reviewQueries[index]?.isError)
  const rows = repos
    .flatMap((repo, index) =>
      reviewQueries[index]?.isError ? [] : (reviewQueries[index]?.data ?? []).map((review) => ({ repo, review })),
    )
    .sort((a, b) => {
      if (a.review.created_at !== b.review.created_at) return a.review.created_at < b.review.created_at ? 1 : -1
      return a.review.id < b.review.id ? 1 : a.review.id > b.review.id ? -1 : 0
    })

  if (rows.length === 0 && failedRepos.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-foreground">Reviews</h1>
        <p className="text-sm text-muted-foreground">No reviews in the last 30 days.</p>
        <Link className="text-sm text-primary underline" to="/repos">
          Repositories
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Reviews</h1>
      {failedRepos.map((repo) => (
        <p key={repo.id} className="text-sm text-destructive" role="alert">
          Could not load reviews for {repositoryDisplayName(repo)}.
        </p>
      ))}
      <ul className="divide-y divide-border border-y border-border">
        {rows.map(({ repo, review }) => (
          <li key={review.id} className="flex items-center justify-between gap-3 py-2.5">
            <ReviewRunLink repo={repo} review={review} />
            <Button asChild size="sm" variant="outline">
              <a
                className="shrink-0"
                href={`https://github.com/${repo.owner}/${repo.name}/pull/${review.pull_request_number}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub pull request
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReviewRunLink({ repo, review }: { repo: Repository; review: AuditReview }) {
  return (
    <Link className="block min-w-0 space-y-0.5" to={`/reviews/${encodeURIComponent(review.id)}`}>
      <p className="truncate text-sm font-medium text-foreground">
        {repositoryDisplayName(repo)} <span className="text-muted-foreground">#{review.pull_request_number}</span>
      </p>
      <p className="truncate text-xs text-muted-foreground">
        <span className="font-mono">{review.requested_head_sha.slice(0, 7)}</span>
        {' · '}
        {STATUS_LABEL[review.status as ReviewStatus]}
        {' · '}
        {PUBLICATION_LABEL[review.publication_status as PublicationStatus]}
        {' · '}
        <time dateTime={review.created_at}>{new Date(review.created_at).toLocaleString()}</time>
        {' · '}
        {review.actor?.login ?? 'Unknown actor'}
      </p>
    </Link>
  )
}
