import type { ReviewComment, Severity } from '@/entities/review-comment/model/types'

export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low']

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/** Стабильная сортировка critical → high → medium → low; исходный массив не меняется. */
export function sortBySeverity<T extends Pick<ReviewComment, 'severity'>>(comments: readonly T[]): T[] {
  return comments
    .map((comment, index) => ({ comment, index }))
    .sort((a, b) => RANK[a.comment.severity] - RANK[b.comment.severity] || a.index - b.index)
    .map(({ comment }) => comment)
}

export function countBySeverity(comments: readonly Pick<ReviewComment, 'severity'>[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const { severity } of comments) counts[severity] += 1
  return counts
}
