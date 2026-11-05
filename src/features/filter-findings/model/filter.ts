import type { ReviewComment, Severity } from '@/entities/review-comment'

export interface FindingFilters {
  /** Show only findings in this file; `null` = every file. */
  path: string | null
  /** Show only this level; `null` = every level. */
  severity: Severity | null
  /** Case-insensitive text search over the finding's text. */
  query: string
}

export const EMPTY_FINDING_FILTERS: FindingFilters = { path: null, severity: null, query: '' }

export function hasActiveFindingFilters(filters: FindingFilters): boolean {
  return filters.path !== null || filters.severity !== null || filters.query !== ''
}

function matchesQuery(finding: ReviewComment, needle: string): boolean {
  if (needle === '') {
    return true
  }
  return [finding.title, finding.explanation, finding.recommendation, finding.evidence].some((text) =>
    text.toLowerCase().includes(needle),
  )
}

export function filterFindings(findings: ReviewComment[], filters: FindingFilters): ReviewComment[] {
  const needle = filters.query.trim().toLowerCase()
  return findings.filter(
    (finding) =>
      (filters.path === null || finding.filePath === filters.path) &&
      (filters.severity === null || finding.severity === filters.severity) &&
      matchesQuery(finding, needle),
  )
}
