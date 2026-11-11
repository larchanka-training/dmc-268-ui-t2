import { expect, test } from 'vitest'
import { findingFiltersFromSearchParams, withFindingFilters } from '@/features/filter-findings'

test('reads file, the first valid severity, and search text from the URL', () => {
  const params = new URLSearchParams('file=src%2Fapi%2Fuser.ts&severity=critical&severity=bogus&severity=low&q=null')

  expect(findingFiltersFromSearchParams(params)).toEqual({
    path: 'src/api/user.ts',
    severity: 'critical',
    query: 'null',
  })
})

test('writes one severity into the URL, dropping empty ones and keeping unrelated params', () => {
  const current = new URLSearchParams('tab=diff&file=old.ts&q=stale')

  const next = withFindingFilters(current, { path: null, severity: 'high', query: 'auth' })

  expect(next.toString()).toBe('tab=diff&severity=high&q=auth')
})
