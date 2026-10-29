import type { ReviewComment, Severity } from '@/entities/review-comment'

export interface FindingFilters {
  /** Show only findings in this file; `null` = every file. */
  path: string | null
  /** Show only these severities; empty = every severity. */
  severities: Severity[]
  /** Case-insensitive text search over the finding's text. */
  query: string
}

export const EMPTY_FINDING_FILTERS: FindingFilters = { path: null, severities: [], query: '' }

export function hasActiveFindingFilters(filters: FindingFilters): boolean {
  return filters.path !== null || filters.severities.length > 0 || filters.query !== ''
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
      (filters.severities.length === 0 || filters.severities.includes(finding.severity)) &&
      matchesQuery(finding, needle),
  )
}
