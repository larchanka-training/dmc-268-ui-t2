import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FindingFilters } from '@/features/filter-findings/model/filter'
import { findingFiltersFromSearchParams, withFindingFilters } from '@/features/filter-findings/model/search-params'

/** Filters live in the URL so a filtered review can be shared and survives reloads. */
export function useFindingFilters(): [FindingFilters, (next: FindingFilters) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => findingFiltersFromSearchParams(searchParams), [searchParams])
  const setFilters = useCallback(
    (next: FindingFilters) => setSearchParams((current) => withFindingFilters(current, next), { replace: true }),
    [setSearchParams],
  )
  return [filters, setFilters]
}
