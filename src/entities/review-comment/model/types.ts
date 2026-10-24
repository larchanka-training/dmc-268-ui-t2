export type Severity = 'critical' | 'warning' | 'info'

export interface ReviewComment {
  id: string
  filePath: string
  side: 'old' | 'new'
  line: number
  severity: Severity
  title: string
  /** markdown/текст */
  body: string
  /** unified diff (допускается без заголовка файла, только `@@`-блоки) */
  suggestedFix?: string
}
