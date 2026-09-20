import type { DiffLine } from '@/entities/diff'

export function getLineAnchor(line: DiffLine): { side: 'old' | 'new'; lineNumber: number } | null {
  if (line.type === 'removed' && line.oldLineNumber != null) {
    return { side: 'old', lineNumber: line.oldLineNumber }
  }

  if (line.newLineNumber != null) {
    return { side: 'new', lineNumber: line.newLineNumber }
  }

  return null
}
