import { Search, X } from 'lucide-react'
import type { ReviewComment } from '@/entities/review-comment'
import {
  EMPTY_FINDING_FILTERS,
  hasActiveFindingFilters,
  type FindingFilters,
} from '@/features/filter-findings/model/filter'
import { Button } from '@/shared/ui/button'

function countBy<T extends string>(findings: ReviewComment[], key: (finding: ReviewComment) => T): Map<T, number> {
  const counts = new Map<T, number>()
  for (const finding of findings) {
    counts.set(key(finding), (counts.get(key(finding)) ?? 0) + 1)
  }
  return counts
}

export interface FindingFiltersPanelProps {
  /** Every finding of the review: file counts come from the unfiltered set. */
  findings: ReviewComment[]
  /** Diff paths in diff order, then comment paths that are not in the diff, in card order. */
  filePaths: readonly string[]
  filters: FindingFilters
  onChange: (next: FindingFilters) => void
}

export function FindingFiltersPanel({ findings, filePaths, filters, onChange }: FindingFiltersPanelProps) {
  const fileCounts = countBy(findings, (finding) => finding.filePath)
  const isFiltered = hasActiveFindingFilters(filters)

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
          {filePaths.map((path) => (
            <option key={path} value={path}>
              {path} ({fileCounts.get(path) ?? 0})
            </option>
          ))}
        </select>
      </label>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs sm:ml-auto"
          onClick={() => onChange(EMPTY_FINDING_FILTERS)}
        >
          <X className="h-3 w-3" aria-hidden />
          Сбросить
        </Button>
      )}
    </section>
  )
}
