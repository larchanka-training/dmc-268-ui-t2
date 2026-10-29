import type { DiffLineType } from '@/entities/diff/model/types'

export const ROW_BG: Record<DiffLineType, string> = {
  add: 'bg-diff-add-bg',
  del: 'bg-diff-del-bg',
  context: 'bg-diff-context-bg',
}

/** Левая полоса в гуттере: строка входит в диапазон замечания AI. */
export const RANGE_MARK = 'border-l-2 border-l-primary'

export const LINE_MARKER: Record<DiffLineType, string> = { add: '+', del: '-', context: ' ' }
