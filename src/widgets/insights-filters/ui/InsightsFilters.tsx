import { Button } from '@/shared/ui/button'
import { useInsightsSelection } from '../model/use-insights-selection'
import { Link } from 'react-router-dom'
import { repositoryDisplayName, useConnectedRepositoriesQuery } from '@/entities/repository'

export function InsightsFilters() {
  const repositories = useConnectedRepositoriesQuery()
  const { repositoryId, days, select } = useInsightsSelection()
  if (repositories.isPending) return <p role="status">Loading repositories…</p>
  if (repositories.isError)
    return (
      <div className="space-y-2">
        <p role="alert" className="text-destructive">
          Could not load repositories.
        </p>
        <Button variant="outline" onClick={() => void repositories.refetch()}>
          Retry repositories
        </Button>
      </div>
    )
  if (repositories.isSuccess && repositories.data.length === 0)
    return (
      <div className="space-y-2">
        <p>No repositories connected yet.</p>
        <Link className="text-primary underline" to="/repos/connect">
          Connect repository
        </Link>
      </div>
    )
  return (
    <div className="flex flex-wrap gap-4">
      <label className="grid gap-1 text-sm">
        Repository
        <select
          className="rounded-md border border-border bg-background p-2"
          value={repositoryId}
          onChange={(event) => select('repository', event.target.value)}
        >
          <option value="">Select repository</option>
          {repositories.data?.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repositoryDisplayName(repo)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Period
        <select
          className="rounded-md border border-border bg-background p-2"
          value={days}
          onChange={(event) => select('days', event.target.value)}
        >
          {[7, 30, 90].map((value) => (
            <option key={value} value={value}>
              Last {value} days
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
