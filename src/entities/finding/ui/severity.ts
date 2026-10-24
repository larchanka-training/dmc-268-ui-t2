import type { FindingSeverity } from '@/entities/finding/model/types'

export const severityLabel: Record<FindingSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const severityBadgeClass: Record<FindingSeverity, string> = {
  critical: 'border-transparent bg-destructive text-destructive-foreground',
  high: 'border-transparent bg-diff-del-bg text-diff-del-fg',
  medium: 'border-border text-foreground',
  low: 'border-transparent bg-muted text-muted-foreground',
}
