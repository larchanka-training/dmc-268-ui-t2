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
  it('sorts critical → warning → info and keeps the original order inside a level', () => {
    const sorted = sortBySeverity([
      c('i1', 'info'),
      c('w1', 'warning'),
      c('c1', 'critical'),
      c('w2', 'warning'),
      c('c2', 'critical'),
    ])

    expect(sorted.map((x) => x.id)).toEqual(['c1', 'c2', 'w1', 'w2', 'i1'])
  })

  it('does not mutate its input', () => {
    const input = [c('i1', 'info'), c('c1', 'critical')]
    sortBySeverity(input)

    expect(input.map((x) => x.id)).toEqual(['i1', 'c1'])
  })

  it('counts comments per severity, including zeros', () => {
    expect(countBySeverity([c('a', 'info'), c('b', 'info'), c('c', 'critical')])).toEqual({
      critical: 1,
      warning: 0,
      info: 2,
    })
  })
})
