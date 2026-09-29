import { useNavigate } from 'react-router-dom'
import { RepositoryHttpError, useAvailableRepositoriesQuery, useConnectRepositoryMutation } from '@/entities/repository'
import type { VcsProvider } from '@/entities/session'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

export function ConnectRepoPanel() {
  const navigate = useNavigate()
  const availableQuery = useAvailableRepositoriesQuery()
  const connectMutation = useConnectRepositoryMutation()

  async function handleConnect(provider: VcsProvider, externalId: string) {
    try {
      await connectMutation.mutateAsync({ provider, externalId })
      navigate('/repos', { replace: true })
    } catch {
      // Error surfaced via connectMutation.isError below
    }
  }

  if (availableQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading available repositories…</p>
  }

  if (availableQuery.isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Could not load available repositories.
      </p>
    )
  }

  const available = availableQuery.data ?? []
  const conflict =
    connectMutation.isError &&
    connectMutation.error instanceof RepositoryHttpError &&
    connectMutation.error.status === 409

  return (
    <div className="space-y-4">
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">No available repositories to connect.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {available.map((repo) => (
            <li key={repo.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{repo.fullName}</span>
                <Badge variant="secondary" className="capitalize">
                  {repo.provider}
                </Badge>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={connectMutation.isPending}
                onClick={() => void handleConnect(repo.provider, repo.externalId)}
              >
                Connect
              </Button>
            </li>
          ))}
        </ul>
      )}

      {conflict ? (
        <p className="text-sm text-destructive" role="alert">
          That repository is already connected.
        </p>
      ) : null}
      {connectMutation.isError && !conflict ? (
        <p className="text-sm text-destructive" role="alert">
          Could not connect repository. Try again.
        </p>
      ) : null}
    </div>
  )
}
