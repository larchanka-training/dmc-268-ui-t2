export type {
  DiffFile,
  DiffFileStatus,
  DiffHunk,
  DiffLine,
  DiffLineType,
<<<<<<< Updated upstream
  ContextGap,
} from '@/entities/diff/model/types'
export { useDiffQuery, useDiffContextQuery } from '@/entities/diff/api/queries'
=======
  SplitRow,
} from '@/entities/diff/model/types'
export { parseUnifiedDiff } from '@/entities/diff/lib/parse-unified-diff'
export { resultingCode } from '@/entities/diff/lib/resulting-code'
export { buildSplitRows } from '@/entities/diff/lib/build-split-rows'
export { highlightHunk, type HunkTokens } from '@/entities/diff/lib/highlight-hunk'
export { languageFromPath, tokenizeLines, type HighlightToken } from '@/entities/diff/lib/tokenize'
export { SplitLineRow, SPLIT_COLUMNS } from '@/entities/diff/ui/SplitLineRow'
export { UnifiedLineRow, UnifiedColGroup, UNIFIED_COLUMNS } from '@/entities/diff/ui/UnifiedLineRow'
>>>>>>> Stashed changes
