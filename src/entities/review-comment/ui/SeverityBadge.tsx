import { SEVERITY_LABEL } from '@/entities/review-comment/lib/severity'
import type { Severity } from '@/entities/review-comment/model/types'
import { SEVERITY_ICON, SEVERITY_TONE } from '@/entities/review-comment/ui/severity-style'
import { cn } from '@/shared/lib/cn'

export interface SeverityBadgeProps {
  severity: Severity
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const Icon = SEVERITY_ICON[severity]
  return (
    <span
      data-testid="severity-badge"
      data-severity={severity}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        SEVERITY_TONE[severity],
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}
