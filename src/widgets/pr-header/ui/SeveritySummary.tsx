import { SEVERITIES, SEVERITY_ICON, SEVERITY_LABEL, SEVERITY_TONE, type Severity } from '@/entities/review-comment'
import { cn } from '@/shared/lib/cn'

export interface SeveritySummaryProps {
  counts: Record<Severity, number>
  /** Клик по счётчику — переход к первому замечанию этого уровня */
  onSelect: (severity: Severity) => void
}

export function SeveritySummary({ counts, onSelect }: SeveritySummaryProps) {
  return (
    <ul data-testid="severity-summary" aria-label="Замечания по severity" className="flex flex-wrap gap-2">
      {SEVERITIES.map((severity) => {
        const Icon = SEVERITY_ICON[severity]
        return (
          <li key={severity}>
            <button
              type="button"
              disabled={counts[severity] === 0}
              onClick={() => onSelect(severity)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                SEVERITY_TONE[severity],
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {SEVERITY_LABEL[severity]}
              <span data-testid={`severity-count-${severity}`} className="rounded bg-background/60 px-1.5 text-xs">
                {counts[severity]}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
