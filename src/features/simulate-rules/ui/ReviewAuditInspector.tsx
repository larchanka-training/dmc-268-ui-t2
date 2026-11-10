import { useId } from 'react'
import type { MockFinding } from '../api/simulate'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'

export function ReviewAuditInspector({
  finding,
  open,
  onToggle,
}: {
  finding: MockFinding
  open: boolean
  onToggle: () => void
}) {
  const id = useId()
  return (
    <>
      <Button type="button" variant="outline" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        Подробнее
      </Button>
      <section
        id={id}
        hidden={!open}
        aria-label="Review Audit Inspector"
        className="min-w-0 space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm [overflow-wrap:anywhere]"
      >
        {open && (
          <>
            <p className="text-xs text-muted-foreground">
              Mock: данные Inspector фиксированы; анализ кода и вызов модели не выполнялись.
            </p>
            <h2 className="font-semibold">{finding.title ?? 'Review Audit Inspector'}</h2>
            <div className="flex flex-wrap items-center gap-2">
              {finding.severity && <Badge variant="outline">{finding.severity}</Badge>}
              {finding.category && <span>{finding.category}</span>}
            </div>
            {(finding.file || finding.line) && (
              <p className="font-mono text-xs">
                {finding.file}
                {finding.line ? `:${finding.line}` : ''}
                {finding.end_line && finding.end_line !== finding.line ? `–${finding.end_line}` : ''}
              </p>
            )}
            {(finding.explanation || finding.message) && (
              <div>
                <h3 className="font-medium">Объяснение</h3>
                <p className="whitespace-pre-wrap">{finding.explanation || finding.message}</p>
              </div>
            )}
            {finding.evidence && (
              <div>
                <h3 className="font-medium">Доказательство</h3>
                <p className="whitespace-pre-wrap font-mono text-xs">{finding.evidence}</p>
              </div>
            )}
            {finding.recommendation && (
              <div>
                <h3 className="font-medium">Рекомендация</h3>
                <p className="whitespace-pre-wrap">{finding.recommendation}</p>
              </div>
            )}
            {finding.model_context && (
              <div>
                <h3 className="font-medium">Контекст модели (из результата)</h3>
                <p className="whitespace-pre-wrap font-mono text-xs">{finding.model_context}</p>
              </div>
            )}
            {finding.rule_ref?.trim() ? (
              <div>
                <h3 className="font-medium">Связанное правило</h3>
                <p className="whitespace-pre-wrap font-mono">{finding.rule_ref}</p>
                {finding.rule_description && <p className="whitespace-pre-wrap">{finding.rule_description}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground">Связанное правило не указано</p>
            )}
          </>
        )}
      </section>
    </>
  )
}
