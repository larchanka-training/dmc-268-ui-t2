/** Шкала UI. Четыре уровня бэкенда сводятся к трём в `parseFinding`. */
export type Severity = 'critical' | 'warning' | 'info'

export type FindingCategory = 'security' | 'correctness' | 'performance' | 'maintainability'

/** Замечание AI — UI-проекция OpenAPI `Finding`. */
export interface ReviewComment {
  id: string
  filePath: string
  side: 'old' | 'new'
  /** Первая строка диапазона (`start_line`) */
  startLine: number
  /** Последняя строка диапазона (`end_line`); под ней показывается карточка — как в GitHub */
  line: number
  severity: Severity
  category: FindingCategory
  title: string
  /** markdown/текст */
  explanation: string
  /** markdown/текст */
  evidence: string
  /** markdown/текст */
  recommendation: string
  /** unified diff (допускается без заголовка файла, только `@@`-блоки) */
  suggestedFix?: string
}
