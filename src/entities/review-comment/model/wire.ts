import type { FindingCategory, ReviewComment, Severity } from '@/entities/review-comment/model/types'

/**
 * OpenAPI `Finding` JSON (`GET /api/v1/reviews/{id}/findings`).
 * Wire SoT: API `openapi.yaml` (Finding / FindingPage).
 */
export type FindingSeverityWire = 'critical' | 'high' | 'medium' | 'low'

export interface FindingWire {
  id: string
  fingerprint: string
  path: string
  side: 'OLD' | 'NEW'
  start_line: number
  end_line: number
  category: FindingCategory
  severity: FindingSeverityWire
  title: string
  explanation: string
  evidence: string
  recommendation: string
  proposed_diff_fix: string | null
  publication_reference: string | null
}

export interface FindingPageWire {
  items: FindingWire[]
  next_cursor: string | null
}

const SEVERITY: Record<FindingSeverityWire, Severity> = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'info',
}

export function parseFinding(wire: FindingWire): ReviewComment {
  return {
    id: wire.id,
    filePath: wire.path,
    side: wire.side === 'OLD' ? 'old' : 'new',
    startLine: wire.start_line,
    line: wire.end_line,
    severity: SEVERITY[wire.severity],
    category: wire.category,
    title: wire.title,
    explanation: wire.explanation,
    evidence: wire.evidence,
    recommendation: wire.recommendation,
    ...(wire.proposed_diff_fix !== null && { suggestedFix: wire.proposed_diff_fix }),
  }
}
