import { FINDING_SEVERITIES, type FindingSeverity } from '@/entities/finding'
import type { FindingFilters } from '@/features/filter-findings/model/filter'

const FILE_PARAM = 'file'
const SEVERITY_PARAM = 'severity'
const QUERY_PARAM = 'q'

function isSeverity(value: string): value is FindingSeverity {
  return (FINDING_SEVERITIES as readonly string[]).includes(value)
}

export function findingFiltersFromSearchParams(params: URLSearchParams): FindingFilters {
  return {
    path: params.get(FILE_PARAM),
    severities: params.getAll(SEVERITY_PARAM).filter(isSeverity),
    query: params.get(QUERY_PARAM) ?? '',
  }
}

/** Returns a copy of `current` with the filter params replaced; empty filters are omitted. */
export function withFindingFilters(current: URLSearchParams, filters: FindingFilters): URLSearchParams {
  const next = new URLSearchParams(current)
  next.delete(FILE_PARAM)
  next.delete(SEVERITY_PARAM)
  next.delete(QUERY_PARAM)
  if (filters.path !== null) {
    next.set(FILE_PARAM, filters.path)
  }
  for (const severity of filters.severities) {
    next.append(SEVERITY_PARAM, severity)
  }
  if (filters.query !== '') {
    next.set(QUERY_PARAM, filters.query)
  }
  return next
}
