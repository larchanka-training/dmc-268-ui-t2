import { RepositoryHttpError } from '@/entities/repository'
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

export function renderConnectError(error: Error, onCheckAgain: () => void, checking: boolean) {
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
          <li>The bot operator accepts the invitation under the bot account — ask them if you are not the operator.</li>
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
