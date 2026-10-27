/**
 * OpenAPI `Diff` JSON (`GET /api/v1/reviews/{id}/diff`).
 * Wire SoT: API `openapi.yaml` (Diff / DiffFile / DiffHunk / DiffLine).
 */

export interface DiffLineWire {
  kind: 'added' | 'deleted' | 'context'
  content: string
  /** null только у added */
  old_line: number | null
  /** null только у deleted */
  new_line: number | null
}

export interface DiffHunkWire {
  old_start: number
  old_lines: number
  new_start: number
  new_lines: number
  lines: DiffLineWire[]
}

export interface DiffFileWire {
  /** Новый путь; для удалённого файла — старый */
  path: string
  /** Только у renamed */
  previous_path: string | null
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: DiffHunkWire[]
}

export interface DiffWire {
  files: DiffFileWire[]
}
