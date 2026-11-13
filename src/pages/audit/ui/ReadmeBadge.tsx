import { useState } from 'react'
import type { ReviewStatus } from '@/entities/pull-request'
import { useAudit } from '@/entities/repository-insights'
import { Button } from '@/shared/ui/button'

const labels = {
  QUEUED: 'Queued',
  FETCHING_DIFF: 'Fetching diff',
  PARSING_CONTEXT: 'Parsing context',
  LLM_PROCESSING: 'Analyzing',
  COMPLETED: 'Completed',
  PARTIAL: 'Partial',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
} satisfies Record<ReviewStatus, string>
const markdown = '![Latest review run](./review-status.svg)'

function snapshot(prefix: string, label: string, description: string) {
  const split = prefix.length * 8 + 12
  const width = split + label.length * 8 + 16
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24" role="img" aria-labelledby="title desc">
<title id="title">${prefix}: ${label}</title><desc id="desc">${description}</desc>
<rect width="${width}" height="24" rx="4" fill="#334155"/><path d="M${split} 0H${width - 4}q4 0 4 4v16q0 4-4 4H${split}Z" fill="#365579"/>
<g fill="#fff" font-family="sans-serif" font-size="12" text-anchor="middle">
<text x="${split / 2}" y="16">${prefix}</text><text x="${(split + width) / 2}" y="16">${label}</text></g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function makeBadge(items: unknown) {
  if (!Array.isArray(items)) return null
  if (items.length === 0) {
    return { label: 'None in 90 days', description: 'No review runs were created in the last 90 UTC calendar days.' }
  }
  const review = items[0]
  if (
    typeof review?.created_at !== 'string' ||
    typeof review?.status !== 'string' ||
    !Object.prototype.hasOwnProperty.call(labels, review.status)
  )
    return null
  const created = new Date(review.created_at)
  if (!Number.isFinite(created.getTime())) return null
  return {
    label: labels[review.status as ReviewStatus],
    description: `Latest review run created ${created.toISOString()} (UTC).`,
  }
}

function BadgeExport({ items, demo }: { items: unknown; demo: boolean }) {
  const badge = makeBadge(items)
  if (!badge) return <p role="alert">Badge unavailable. The history data could not be read.</p>
  const { label, description } = badge
  const prefix = demo ? 'Demo review run' : 'Review run'
  const href = snapshot(prefix, label, description)
  return (
    <div className="grid min-w-0 gap-3 text-sm">
      <img src={href} alt={`${prefix}: ${label}`} />
      <p>{description} This shows the execution status. A completed review can have findings.</p>
      <Button asChild variant="outline" className="w-fit">
        <a href={href} download="review-status.svg">
          Download SVG
        </a>
      </Button>
      <label className="grid gap-1">
        README Markdown
        <input
          className="min-w-0 rounded-md border border-border bg-background p-2 font-mono text-xs"
          readOnly
          value={markdown}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <p className="text-muted-foreground">
        Commit the SVG next to your root README.md and paste the Markdown there. Replace the SVG after a new run.
      </p>
    </div>
  )
}

function BadgeSnapshot({ repositoryId }: { repositoryId: string }) {
  const query = useAudit(repositoryId, 90, '', { limit: 1, refetchOnMount: 'always' })
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold">README badge</h2>
        <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
          Refresh badge
        </Button>
      </div>
      {query.isFetching || query.isPending ? (
        <p role="status">Loading latest review run…</p>
      ) : query.isError ? (
        <p role="alert">Badge unavailable. {query.error.message}</p>
      ) : (
        <BadgeExport items={query.data.pages[0]?.items} demo={query.data.pages[0]?.demo} />
      )}
    </>
  )
}

export function ReadmeBadge({ repositoryId }: { repositoryId: string }) {
  const [opened, setOpened] = useState(false)
  return (
    <section aria-label="README badge" className="space-y-3 rounded-lg border border-border p-4">
      {opened ? (
        <BadgeSnapshot repositoryId={repositoryId} />
      ) : (
        <Button variant="outline" onClick={() => setOpened(true)}>
          Generate README badge
        </Button>
      )}
    </section>
  )
}
