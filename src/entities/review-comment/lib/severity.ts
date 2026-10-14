import type { ReviewComment, Severity } from '@/entities/review-comment/model/types'

export const SEVERITIES: readonly Severity[] = ['critical', 'warning', 'info']

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
}

/** Стабильная сортировка critical → warning → info; исходный массив не меняется. */
export function sortBySeverity<T extends Pick<ReviewComment, 'severity'>>(comments: readonly T[]): T[] {
  return comments
    .map((comment, index) => ({ comment, index }))
    .sort((a, b) => RANK[a.comment.severity] - RANK[b.comment.severity] || a.index - b.index)
    .map(({ comment }) => comment)
}

export function countBySeverity(comments: readonly Pick<ReviewComment, 'severity'>[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 }
  for (const { severity } of comments) counts[severity] += 1
  return counts
}
