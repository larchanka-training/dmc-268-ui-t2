import { describe, expect, it } from 'vitest'
import { countBySeverity, sortBySeverity } from '@/entities/review-comment/lib/severity'
import type { ReviewComment, Severity } from '@/entities/review-comment/model/types'

const c = (id: string, severity: Severity): ReviewComment => ({
  id,
  filePath: 'a.ts',
  side: 'new',
  startLine: 1,
  line: 1,
  severity,
  category: 'correctness',
  title: id,
  explanation: id,
  evidence: id,
  recommendation: id,
})

describe('severity helpers', () => {
  it('sorts critical → high → medium → low and keeps the original order inside a level', () => {
    const sorted = sortBySeverity([
      c('l1', 'low'),
      c('m1', 'medium'),
      c('h1', 'high'),
      c('c1', 'critical'),
      c('h2', 'high'),
      c('c2', 'critical'),
    ])

    expect(sorted.map((x) => x.id)).toEqual(['c1', 'c2', 'h1', 'h2', 'm1', 'l1'])
  })

  it('does not mutate its input', () => {
    const input = [c('l1', 'low'), c('c1', 'critical')]
    sortBySeverity(input)

    expect(input.map((x) => x.id)).toEqual(['l1', 'c1'])
  })

  it('counts comments per severity, including zeros', () => {
    expect(countBySeverity([c('a', 'low'), c('b', 'low'), c('c', 'critical'), c('d', 'medium')])).toEqual({
      critical: 1,
      high: 0,
      medium: 1,
      low: 2,
    })
  })
})
