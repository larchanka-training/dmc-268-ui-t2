import { Link, useParams } from 'react-router-dom'
import { useRepositoryPullRequestsQuery } from '@/entities/pull-request'
import { StartReviewButton } from '@/features/start-review'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

export function RepositoryPullRequestsPage() {
  const { repositoryId = '' } = useParams()
  const pullRequestsQuery = useRepositoryPullRequestsQuery(repositoryId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Open pull requests</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/repos/${encodeURIComponent(repositoryId)}/settings`}>Rules &amp; settings</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/repos">Back to repositories</Link>
          </Button>
        </div>
      </div>

      {pullRequestsQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading pull requests…</p>
      ) : pullRequestsQuery.isError ? (
        <p className="text-sm text-destructive" role="alert">
          Could not load pull requests.
        </p>
      ) : pullRequestsQuery.data.length === 0 ? (
        <EmptyState title="No open pull requests." />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {pullRequestsQuery.data.map((pr) => (
            <li key={pr.number} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">#{pr.number}</span> {pr.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {pr.author.login} · {pr.sourceBranch} → {pr.targetBranch}
                </p>
              </div>
              <StartReviewButton repositoryId={repositoryId} pullRequest={pr} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
