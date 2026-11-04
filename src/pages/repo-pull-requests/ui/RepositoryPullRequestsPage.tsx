import { Link, useParams } from 'react-router-dom'
import { useRepositoryPullRequestsQuery } from '@/entities/pull-request'
import { StartReviewButton } from '@/features/start-review'
import { Button } from '@/shared/ui/button'

export function RepositoryPullRequestsPage() {
  const { repositoryId = '' } = useParams()
  const pullRequestsQuery = useRepositoryPullRequestsQuery(repositoryId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-foreground">Open pull requests</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/repos">Back to repositories</Link>
        </Button>
      </div>

      {pullRequestsQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading pull requests…</p>
      ) : pullRequestsQuery.isError ? (
        <p className="text-sm text-destructive" role="alert">
          Could not load pull requests.
        </p>
      ) : pullRequestsQuery.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open pull requests.</p>
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
