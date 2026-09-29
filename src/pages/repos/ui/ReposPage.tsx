import { Link } from 'react-router-dom'
import { useConnectedRepositoriesQuery } from '@/entities/repository'
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
              <span className="truncate text-sm font-medium text-foreground">{repo.fullName}</span>
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
