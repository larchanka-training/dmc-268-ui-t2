import { Link } from 'react-router-dom'
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
            <li key={repo.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{repositoryDisplayName(repo)}</span>
                <Badge variant="outline" className="capitalize">
                  {repo.role}
                </Badge>
              </div>
              <Badge variant="secondary" className="capitalize">
                {repo.provider}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
