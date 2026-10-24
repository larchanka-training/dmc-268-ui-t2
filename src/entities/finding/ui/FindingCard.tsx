import { Bot } from 'lucide-react'
import type { Finding, FindingCategory } from '@/entities/finding/model/types'
import { severityBadgeClass, severityLabel } from '@/entities/finding/ui/severity'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/cn'

const categoryLabel: Record<FindingCategory, string> = {
  security: 'Безопасность',
  correctness: 'Корректность',
  performance: 'Производительность',
  maintainability: 'Поддерживаемость',
}

function lineRange(finding: Finding) {
  return finding.startLine === finding.endLine
    ? `Строка ${finding.startLine}`
    : `Строки ${finding.startLine}–${finding.endLine}`
}

export interface FindingCardProps {
  finding: Finding
  className?: string
}

export function FindingCard({ finding, className }: FindingCardProps) {
  return (
    <article className={cn('rounded-md border border-border bg-card', className)} aria-label={finding.title}>
      <header className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <Badge className={severityBadgeClass[finding.severity]}>{severityLabel[finding.severity]}</Badge>
        <Badge variant="outline">{categoryLabel[finding.category]}</Badge>
        <span className="text-xs text-muted-foreground">{lineRange(finding)}</span>
      </header>
      <div className="flex flex-col gap-1.5 px-3 py-2 text-sm">
        <p className="font-medium">{finding.title}</p>
        <p className="whitespace-pre-wrap text-foreground">{finding.explanation}</p>
        {finding.evidence && (
          <pre className="overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">{finding.evidence}</pre>
        )}
        <p className="whitespace-pre-wrap text-muted-foreground">
          <span className="font-medium text-foreground">Рекомендация: </span>
          {finding.recommendation}
        </p>
        {finding.proposedDiffFix && (
          <pre className="overflow-x-auto rounded bg-diff-add-bg px-2 py-1 font-mono text-xs text-diff-add-fg">
            {finding.proposedDiffFix}
          </pre>
        )}
      </div>
    </article>
  )
}
