export type DiffLineType = 'add' | 'del' | 'context'

export interface DiffLine {
  type: DiffLineType
  /** Номер строки в старой версии файла; null для add-строк */
  oldNo: number | null
  /** Номер строки в новой версии файла; null для del-строк */
  newNo: number | null
  content: string
  /** Строка помечена `\ No newline at end of file` */
  noNewline?: boolean
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  /** Текст после второго `@@` (обычно имя функции) */
  section: string
  lines: DiffLine[]
}

export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed'

export interface DiffFile {
  oldPath: string | null
  newPath: string | null
  /** Путь для отображения и якорей: newPath, а для удалённых файлов oldPath */
  path: string
  status: DiffFileStatus
  isBinary: boolean
  hunks: DiffHunk[]
  additions: number
  deletions: number
}

/** Пара ячеек side-by-side. context-строка стоит с обеих сторон (left === right). */
export interface SplitRow {
  left: DiffLine | null
  right: DiffLine | null
}
