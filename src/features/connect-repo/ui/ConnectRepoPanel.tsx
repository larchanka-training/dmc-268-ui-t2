import { useNavigate } from 'react-router-dom'
import {
  repositoryDisplayName,
  RepositoryHttpError,
  useAvailableRepositoriesQuery,
  useConnectRepositoryMutation,
} from '@/entities/repository'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

function isBotAccessRequired(error: Error): error is RepositoryHttpError {
  return error instanceof RepositoryHttpError && error.status === 409 && error.code === 'BOT_ACCESS_REQUIRED'
}

/** Server-supplied URL: link only when it is a well-formed `https:` URL. */
function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).protocol === 'https:' ? value : null
  } catch {
    return null
  }
}

function renderConnectError(error: Error, onCheckAgain: () => void, checking: boolean) {
  if (isBotAccessRequired(error)) {
    const accessUrl = safeHttpsUrl(error.accessUrl)
    return (
      <div className="space-y-2 text-sm" role="alert">
        <p className="text-foreground">
          The review bot {error.botLogin ? <strong>{error.botLogin}</strong> : null}
          {error.botLogin ? ' ' : null}needs Write access to this repository.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            {accessUrl ? (
              <a
                href={accessUrl}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                Open repository access settings
              </a>
            ) : (
              'Open the repository access settings'
            )}{' '}
            and invite the bot with Write access.
          </li>
          <li>Sign in as the bot and accept the invitation.</li>
          <li>Come back here and check again.</li>
        </ol>
        <Button type="button" size="sm" variant="outline" disabled={checking} onClick={onCheckAgain}>
          Check again
        </Button>
      </div>
    )
  }
  return (
    <p className="text-sm text-destructive" role="alert">
      {error instanceof RepositoryHttpError && error.status === 503
        ? 'The server is not ready to connect repositories (server setup or GitHub is unavailable). Try again later or ask an admin to check the server configuration.'
        : 'Could not connect repository. Try again.'}
    </p>
  )
}

export function ConnectRepoPanel() {
  const navigate = useNavigate()
  const availableQuery = useAvailableRepositoriesQuery()
  const connectMutation = useConnectRepositoryMutation()

  async function handleConnect(externalId: string) {
    try {
      await connectMutation.mutateAsync({ provider: 'github', externalId })
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

  return (
    <div className="space-y-4">
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">No available repositories to connect.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {available.map((repo) => (
            <li key={`${repo.provider}:${repo.externalId}`} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{repositoryDisplayName(repo)}</span>
                <Badge variant="secondary" className="capitalize">
                  {repo.provider}
                </Badge>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={connectMutation.isPending}
                onClick={() => void handleConnect(repo.externalId)}
              >
                Connect
              </Button>
            </li>
          ))}
        </ul>
      )}

      {connectMutation.isError
        ? renderConnectError(
            connectMutation.error,
            () => void handleConnect(connectMutation.variables.externalId),
            connectMutation.isPending,
          )
        : null}
    </div>
  )
}
