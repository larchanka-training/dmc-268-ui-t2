import { Button } from '@/shared/ui/button'
import { Link, useSearchParams } from 'react-router-dom'
import { useAudit } from '@/entities/repository-insights'
import { InsightsFilters, useInsightsSelection } from '@/widgets/insights-filters'

const limitLabels = { file_limit: 'file count', line_limit: 'line count', token_budget: 'token budget' }

export function AuditPage() {
  const { repositoryId, days, select } = useInsightsSelection()
  const [params] = useSearchParams()
  const statuses = [
    'QUEUED',
    'FETCHING_DIFF',
    'PARSING_CONTEXT',
    'LLM_PROCESSING',
    'COMPLETED',
    'PARTIAL',
    'FAILED',
    'SKIPPED',
  ]
  const status = statuses.includes(params.get('status') ?? '') ? params.get('status')! : ''
  const query = useAudit(repositoryId, days, status)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Review audit log</h1>
      <div className="flex flex-wrap items-end gap-4">
        <InsightsFilters />
        <label className="grid gap-1 text-sm">
          Analysis status
          <select
            className="rounded-md border border-border bg-background p-2"
            value={status}
            onChange={(event) => select('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {repositoryId && query.isPending && <p role="status">Loading review audit…</p>}
      {query.isSuccess && query.data.pages.every((page) => page.items.length === 0) && (
        <p>No review runs match these filters.</p>
      )}
      {query.isError && (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      )}
      {!query.isError && query.data && (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Review runs</caption>
            <thead>
              <tr>
                {['Created (UTC)', 'Review', 'Triggered by', 'Status', 'Tokens', 'Cost'].map((title) => (
                  <th key={title} className="whitespace-nowrap p-3">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.pages
                .flatMap((page) => page.items)
                .map((review) => (
                  <tr key={review.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap p-3">
                      <time dateTime={review.created_at}>
                        {new Date(review.created_at).toISOString().replace('T', ' ').replace('.000Z', '')}
                      </time>
                    </td>
                    <td className="p-3">
                      <Link
                        className="whitespace-nowrap text-primary underline"
                        to={`/reviews/${encodeURIComponent(review.id)}`}
                      >
                        PR #{review.pull_request_number}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground" title={review.requested_head_sha}>
                        {review.requested_head_sha.slice(0, 7)}
                      </p>
                    </td>
                    <td className="p-3">
                      <p>{review.actor?.login ?? 'Unknown actor'}</p>
                      <p className="text-xs text-muted-foreground">{review.trigger_type}</p>
                    </td>
                    <td className="p-3">
                      <p>{review.status}</p>
                      <p className="whitespace-nowrap text-xs text-muted-foreground">
                        Publication: {review.publication_status}
                      </p>
                      {review.limit_reasons.length > 0 && (
                        <p role="alert" className="mt-2 min-w-48 text-amber-700">
                          Analysis limited: {review.limit_reasons.map((reason) => limitLabels[reason]).join(', ')}. Some
                          changes were not analyzed.
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="whitespace-nowrap">
                        {review.usage.input_tokens ?? 'Unknown'} input / {review.usage.output_tokens ?? 'Unknown'}{' '}
                        output
                      </p>
                      {review.usage.status === 'unavailable' && <p>Usage unavailable</p>}
                      {review.usage.status === 'incomplete' && <p className="text-amber-700">Incomplete usage</p>}
                      <p className="whitespace-nowrap text-xs text-muted-foreground">
                        Reserved: {review.usage.reserved_input_tokens} input / {review.usage.reserved_output_tokens}{' '}
                        output
                      </p>
                    </td>
                    <td className="whitespace-nowrap p-3">Cost unavailable</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {!query.isError && query.hasNextPage && (
        <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
