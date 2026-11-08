import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: ReactNode
  /** Основное действие пустого состояния: кнопка или ссылка. */
  children?: ReactNode
}

/** Единый вид пустых состояний списков и разделов (спринт 5, issue #40). */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}
