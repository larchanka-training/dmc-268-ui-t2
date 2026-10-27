import type { HighlightToken } from '@/entities/diff/lib/tokenize'
import type { DiffLine } from '@/entities/diff/model/types'
import { LINE_MARKER, RANGE_MARK, ROW_BG } from '@/entities/diff/ui/line-style'
import { HighlightedCode } from '@/entities/diff/ui/HighlightedCode'
import { cn } from '@/shared/lib/cn'

export const UNIFIED_COLUMNS = 4

export function LineContent({ line, tokens }: { line: DiffLine; tokens?: HighlightToken[] }) {
  return (
    <>
      {tokens ? <HighlightedCode tokens={tokens} /> : line.content}
      {line.noNewline && (
        <span data-testid="no-newline" className="ml-2 select-none text-xs italic text-muted-foreground">
          ⏎ No newline at end of file
        </span>
      )}
    </>
  )
}

export interface UnifiedLineRowProps {
  line: DiffLine
  tokens?: HighlightToken[]
  /** `diff-row` для diff файла, `fix-row` для мини-diff в карточке */
  testId?: string
  /** Строка входит в диапазон start_line…end_line замечания AI */
  inCommentRange?: boolean
}

const gutter = 'select-none bg-diff-gutter-bg px-2 text-right align-top text-muted-foreground'

/** Одна строка unified-таблицы: old№ | new№ | маркер | код. */
export function UnifiedLineRow({ line, tokens, testId = 'diff-row', inCommentRange }: UnifiedLineRowProps) {
  return (
    <tr
      data-testid={testId}
      data-line-type={line.type}
      data-old-line={line.oldNo ?? undefined}
      data-new-line={line.newNo ?? undefined}
      data-in-comment-range={inCommentRange ? 'true' : undefined}
      className={cn('leading-5', ROW_BG[line.type])}
    >
      <td className={cn(gutter, inCommentRange && RANGE_MARK)}>{line.oldNo}</td>
      <td className={gutter}>{line.newNo}</td>
      <td data-testid="line-marker" className="select-none text-center align-top text-muted-foreground">
        {LINE_MARKER[line.type]}
      </td>
      <td data-testid="line-content" className="whitespace-pre-wrap break-all px-1">
        <LineContent line={line} tokens={tokens} />
      </td>
    </tr>
  )
}

export function UnifiedColGroup() {
  return (
    <colgroup>
      <col className="w-12" />
      <col className="w-12" />
      <col className="w-6" />
      <col />
    </colgroup>
  )
}
