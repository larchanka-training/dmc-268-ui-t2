import { Search, X } from 'lucide-react'
import {
  FINDING_SEVERITIES,
  severityBadgeClass,
  severityLabel,
  type Finding,
  type FindingSeverity,
} from '@/entities/finding'
import {
  EMPTY_FINDING_FILTERS,
  hasActiveFindingFilters,
  type FindingFilters,
} from '@/features/filter-findings/model/filter'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/cn'

function countBy<T extends string>(findings: Finding[], key: (finding: Finding) => T): Map<T, number> {
  const counts = new Map<T, number>()
  for (const finding of findings) {
    counts.set(key(finding), (counts.get(key(finding)) ?? 0) + 1)
  }
  return counts
}

export interface FindingFiltersPanelProps {
  /** Every finding of the review: options and counts come from the unfiltered set. */
  findings: Finding[]
  filters: FindingFilters
  onChange: (next: FindingFilters) => void
  shownCount: number
}

export function FindingFiltersPanel({ findings, filters, onChange, shownCount }: FindingFiltersPanelProps) {
  const fileCounts = countBy(findings, (finding) => finding.path)
  const severityCounts = countBy(findings, (finding) => finding.severity)
  const files = [...fileCounts.keys()].sort()
  const isFiltered = hasActiveFindingFilters(filters)

  function toggleSeverity(severity: FindingSeverity) {
    const severities = filters.severities.includes(severity)
      ? filters.severities.filter((selected) => selected !== severity)
      : [...filters.severities, severity]
    onChange({ ...filters, severities })
  }

  return (
    <section
      aria-label="Фильтры замечаний"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <label className="relative flex min-w-0 flex-1 items-center sm:min-w-[14rem]">
        <span className="sr-only">Поиск по замечаниям</span>
        <Search className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Поиск по тексту замечаний"
          className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="flex min-w-0 items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">Файл</span>
        <select
          value={filters.path ?? ''}
          onChange={(event) => onChange({ ...filters, path: event.target.value === '' ? null : event.target.value })}
          className="h-8 min-w-0 max-w-full rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[18rem]"
        >
          <option value="">Все файлы ({findings.length})</option>
          {files.map((path) => (
            <option key={path} value={path}>
              {path} ({fileCounts.get(path)})
            </option>
          ))}
        </select>
      </label>

      <div role="group" aria-label="Критичность" className="flex flex-wrap items-center gap-1.5">
        {FINDING_SEVERITIES.map((severity) => {
          const selected = filters.severities.includes(severity)
          return (
            <button
              key={severity}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleSeverity(severity)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                severityBadgeClass[severity],
                filters.severities.length > 0 && !selected && 'opacity-40',
                selected && 'ring-2 ring-ring',
              )}
            >
              {severityLabel[severity]}
              <span className="tabular-nums">{severityCounts.get(severity) ?? 0}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 sm:ml-auto">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          Показано {shownCount} из {findings.length}
        </span>
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange(EMPTY_FINDING_FILTERS)}
          >
            <X className="h-3 w-3" aria-hidden />
            Сбросить
          </Button>
        )}
      </div>
    </section>
  )
}
