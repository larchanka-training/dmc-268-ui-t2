export type DiffLineType = 'added' | 'removed' | 'context'

export interface DiffLine {
  id: string
  type: DiffLineType
  oldLineNumber: number | null
  newLineNumber: number | null
  content: string
}

export interface ContextGap {
  /** Первая скрытая строка исходного файла (нумерация по new-стороне) */
  startLine: number
  lineCount: number
}

export interface DiffHunk {
  id: string
  header: string
  contextBefore: ContextGap | null
  lines: DiffLine[]
  contextAfter: ContextGap | null
}

export type DiffFileStatus = 'added' | 'modified' | 'removed' | 'renamed'

export interface DiffFile {
  id: string
  filePath: string
  language: string
  status: DiffFileStatus
  additions: number
  deletions: number
  hunks: DiffHunk[]
}
