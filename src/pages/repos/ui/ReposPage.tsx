import { Link } from 'react-router-dom'
import { CheckAccessButton } from '@/features/connect-repo'
import { repositoryDisplayName, useConnectedRepositoriesQuery } from '@/entities/repository'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

export function ReposPage() {
  const reposQuery = useConnectedRepositoriesQuery()

  if (reposQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading repositories…</p>
  }

  if (reposQuery.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Could not load connected repositories.
      </p>
    )
  }

  const repos = reposQuery.data ?? []
  const isEmpty = repos.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-foreground">Repositories</h1>
        {!isEmpty ? (
          <Button asChild size="sm">
            <Link to="/repos/connect">Connect repository</Link>
          </Button>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="space-y-3 py-8">
          <p className="text-sm text-muted-foreground">
            No repositories connected yet. Connect one to start reviewing changes.
          </p>
          <Button asChild>
            <Link to="/repos/connect">Connect repository</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {repos.map((repo) => (
            <li
              key={repo.id}
              className="flex flex-col items-start justify-between gap-3 py-2.5 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{repositoryDisplayName(repo)}</span>
                <Badge variant="outline" className="capitalize">
                  {repo.role}
                </Badge>
              </div>
              <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                <Badge variant="secondary" className="capitalize">
                  {repo.provider}
                </Badge>
                {repo.capabilities.canManageSettings ? <CheckAccessButton repository={repo} /> : null}
                <Button asChild size="sm" variant="outline">
                  <Link to={`/repos/${encodeURIComponent(repo.id)}/settings`}>Rules &amp; settings</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/repos/${encodeURIComponent(repo.id)}/rule-playground`}>Rule Playground</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/repos/${encodeURIComponent(repo.id)}/pull-requests`}>Pull requests</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
