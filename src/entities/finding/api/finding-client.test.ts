import { afterEach, expect, test, vi } from 'vitest'
import { fetchReviewFindings } from '@/entities/finding'

afterEach(() => {
  vi.unstubAllGlobals()
})

function findingWire(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    fingerprint: `fp-${id}`,
    path: 'src/api/user.ts',
    side: 'NEW',
    start_line: 11,
    end_line: 12,
    category: 'correctness',
    severity: 'high',
    title: 'Missing error handling',
    explanation: 'The caller does not handle UserNotFoundError.',
    evidence: 'throw new UserNotFoundError(id)',
    recommendation: 'Catch the error at the call site.',
    proposed_diff_fix: null,
    publication_reference: null,
    ...overrides,
  }
}

test('fetchReviewFindings follows next_cursor and maps findings into the UI shape', async () => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      if (calls.length === 1) {
        return Response.json({ items: [findingWire('f1')], next_cursor: 'c+2' })
      }
      return Response.json({ items: [findingWire('f2', { side: 'OLD', severity: 'low' })], next_cursor: null })
    }),
  )

  const findings = await fetchReviewFindings('rev-1')

  expect(calls).toEqual([
    '/api/v1/reviews/rev-1/findings?limit=100',
    '/api/v1/reviews/rev-1/findings?limit=100&cursor=c%2B2',
  ])
  expect(findings[0]).toEqual({
    id: 'f1',
    path: 'src/api/user.ts',
    side: 'new',
    startLine: 11,
    endLine: 12,
    category: 'correctness',
    severity: 'high',
    title: 'Missing error handling',
    explanation: 'The caller does not handle UserNotFoundError.',
    evidence: 'throw new UserNotFoundError(id)',
    recommendation: 'Catch the error at the call site.',
    proposedDiffFix: null,
  })
  expect(findings.map((finding) => `${finding.id}:${finding.side}:${finding.severity}`)).toEqual([
    'f1:new:high',
    'f2:old:low',
  ])
})
