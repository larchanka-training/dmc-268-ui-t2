import { Button } from '@/shared/ui/button'
import { useQuotas } from '@/entities/repository-insights'

export function QuotaPanel({ repositoryId }: { repositoryId: string }) {
  const query = useQuotas(repositoryId)
  if (query.isError)
    return (
      <section className="space-y-2 rounded-lg border border-border p-4">
        <p role="alert">Could not load current limits.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry limits
        </Button>
      </section>
    )
  if (!query.data) return null
  const { starts_per_hour: starts, active_jobs: active } = query.data
  const disabled = starts.limit === 0 || active.limit === 0
  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Repository limits">
      <h2 className="font-semibold">Current limits</h2>
      {disabled && (
        <p role="alert" className="text-destructive">
          Review starts are disabled by repository limits. Contact a repository administrator.
        </p>
      )}
      <p className="text-sm">
        Your starts in this repository: {starts.used} / {starts.limit} per hour · {starts.remaining} remaining
      </p>
      {!disabled && starts.remaining === 0 && (
        <p role="alert" className="text-destructive">
          Hourly review start limit reached. Wait until{' '}
          <time>
            {starts.resets_at
              ? new Date(starts.resets_at).toISOString().replace('T', ' ').replace('.000Z', ' UTC')
              : 'capacity is available'}
          </time>
          .
        </p>
      )}
      <p className="text-sm">
        Repository active reviews: {active.used} / {active.limit} · {active.remaining} remaining
      </p>
      {!disabled && active.remaining === 0 && (
        <p role="alert" className="text-destructive">
          Repository active review limit reached. Wait for an active review to finish.
        </p>
      )}
      <p className="text-sm text-muted-foreground">Daily token quota is unavailable; no daily policy is configured.</p>
    </section>
  )
}
