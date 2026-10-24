/** Most to least severe; also the display order. */
export const FINDING_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]

export type FindingCategory = 'security' | 'correctness' | 'performance' | 'maintainability'

/** OpenAPI `Finding` (fields the UI reads). */
export interface FindingWire {
  id: string
  path: string
  side: 'OLD' | 'NEW'
  start_line: number
  end_line: number
  category: FindingCategory
  severity: FindingSeverity
  title: string
  explanation: string
  evidence: string
  recommendation: string
  proposed_diff_fix: string | null
}

/** Validated AI finding anchored to a line range on one side of the diff. */
export interface Finding {
  id: string
  path: string
  side: 'old' | 'new'
  startLine: number
  endLine: number
  category: FindingCategory
  severity: FindingSeverity
  title: string
  explanation: string
  evidence: string
  recommendation: string
  proposedDiffFix: string | null
}

export function parseFinding(wire: FindingWire): Finding {
  return {
    id: wire.id,
    path: wire.path,
    side: wire.side === 'OLD' ? 'old' : 'new',
    startLine: wire.start_line,
    endLine: wire.end_line,
    category: wire.category,
    severity: wire.severity,
    title: wire.title,
    explanation: wire.explanation,
    evidence: wire.evidence,
    recommendation: wire.recommendation,
    proposedDiffFix: wire.proposed_diff_fix,
  }
}
