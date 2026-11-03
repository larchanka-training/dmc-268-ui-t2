import { useConnectRepositoryMutation, type Repository } from '@/entities/repository'
import { Button } from '@/shared/ui/button'
import { renderConnectError } from '@/features/connect-repo/ui/render-connect-error'

/** Re-runs POST /repositories/connect for an already-connected repo (admin Write check; success clears bot_denied). */
export function CheckAccessButton({ repository }: { repository: Repository }) {
  const connect = useConnectRepositoryMutation()
  const run = () => connect.mutate({ provider: repository.provider, externalId: repository.externalId })

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={connect.isPending} onClick={run}>
        Check access
      </Button>
      {connect.isSuccess ? (
        <p className="text-xs text-muted-foreground" role="status">
          Access confirmed.
        </p>
      ) : null}
      {connect.isError ? renderConnectError(connect.error, run, connect.isPending) : null}
    </div>
  )
}
