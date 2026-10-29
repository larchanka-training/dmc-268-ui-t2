import { expect, test } from 'vitest'
import { findingFiltersFromSearchParams, withFindingFilters } from '@/features/filter-findings'

test('reads file, severities and search text from the URL, ignoring unknown severities', () => {
  const params = new URLSearchParams('file=src%2Fapi%2Fuser.ts&severity=critical&severity=bogus&severity=low&q=null')

  expect(findingFiltersFromSearchParams(params)).toEqual({
    path: 'src/api/user.ts',
    severities: ['critical', 'low'],
    query: 'null',
  })
})

test('writes filters into the URL, dropping empty ones and keeping unrelated params', () => {
  const current = new URLSearchParams('tab=diff&file=old.ts&q=stale')

  const next = withFindingFilters(current, { path: null, severities: ['high', 'medium'], query: 'auth' })

  expect(next.toString()).toBe('tab=diff&severity=high&severity=medium&q=auth')
})
