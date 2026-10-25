import { describe, expect, it } from 'vitest'
import { parseFinding, type FindingWire } from '@/entities/review-comment/model/wire'

const wire: FindingWire = {
  id: 'f1',
  fingerprint: 'sha256:f1',
  path: 'src/a.ts',
  side: 'OLD',
  start_line: 3,
  end_line: 5,
  category: 'security',
  severity: 'critical',
  title: 'Title',
  explanation: 'Explanation',
  evidence: 'Evidence',
  recommendation: 'Recommendation',
  proposed_diff_fix: '@@ -1 +1 @@\n-a\n+b\n',
  publication_reference: null,
}

describe('parseFinding (OpenAPI Finding → ReviewComment)', () => {
  it('maps fields; the card anchors to end_line', () => {
    expect(parseFinding(wire)).toEqual({
      id: 'f1',
      filePath: 'src/a.ts',
      side: 'old',
      startLine: 3,
      line: 5,
      severity: 'critical',
      category: 'security',
      title: 'Title',
      explanation: 'Explanation',
      evidence: 'Evidence',
      recommendation: 'Recommendation',
      suggestedFix: '@@ -1 +1 @@\n-a\n+b\n',
    })
  })

  it.each([
    ['critical', 'critical'],
    ['high', 'warning'],
    ['medium', 'info'],
    ['low', 'info'],
  ] as const)('maps backend severity %s to UI %s', (backend, ui) => {
    expect(parseFinding({ ...wire, severity: backend }).severity).toBe(ui)
  })

  it('omits suggestedFix when proposed_diff_fix is null and maps NEW side', () => {
    const comment = parseFinding({ ...wire, side: 'NEW', proposed_diff_fix: null })

    expect(comment).not.toHaveProperty('suggestedFix')
    expect(comment.side).toBe('new')
  })
})
