import type { DiffLineType } from '@/entities/diff/model/types'

export const ROW_BG: Record<DiffLineType, string> = {
  add: 'bg-diff-add-bg',
  del: 'bg-diff-del-bg',
  context: 'bg-diff-context-bg',
}

export const LINE_MARKER: Record<DiffLineType, string> = { add: '+', del: '-', context: ' ' }
