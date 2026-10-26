import type { HunkTokens } from '@/entities/diff/lib/highlight-hunk'
import type { DiffLine, SplitRow } from '@/entities/diff/model/types'
import { LINE_MARKER, RANGE_MARK, ROW_BG } from '@/entities/diff/ui/line-style'
import { LineContent } from '@/entities/diff/ui/UnifiedLineRow'
import { cn } from '@/shared/lib/cn'

export const SPLIT_COLUMNS = 4

const gutter = 'select-none bg-diff-gutter-bg px-2 text-right align-top text-muted-foreground'

function rowType(row: SplitRow): string {
  if (row.left && row.right) return row.left === row.right ? 'context' : 'change'
  return (row.left ?? row.right)?.type ?? 'context'
}

interface CellProps {
  line: DiffLine | null
  tokens: HunkTokens
  side: 'left' | 'right'
}

function Cell({ line, tokens, side }: CellProps) {
  return (
    <td
      data-testid={`cell-${side}`}
      className={cn('w-1/2 whitespace-pre-wrap break-all px-1 align-top', line ? ROW_BG[line.type] : 'bg-muted/40')}
    >
      {line && (
        <>
          <span data-testid="line-marker" className="mr-1 select-none text-muted-foreground">
            {LINE_MARKER[line.type]}
          </span>
          <span data-testid="line-content">
            <LineContent line={line} tokens={tokens.get(line)} />
          </span>
        </>
      )}
    </td>
  )
}

export interface SplitLineRowProps {
  row: SplitRow
  tokens: HunkTokens
  /** Строка входит в диапазон start_line…end_line замечания AI */
  inCommentRange?: boolean
}

/** Одна строка side-by-side: old№ | код | new№ | код. */
export function SplitLineRow({ row, tokens, inCommentRange }: SplitLineRowProps) {
  const { left, right } = row
  return (
    <tr
      data-testid="diff-row"
      data-line-type={rowType(row)}
      data-old-line={left?.oldNo ?? undefined}
      data-new-line={right?.newNo ?? undefined}
      data-in-comment-range={inCommentRange ? 'true' : undefined}
      className="leading-5"
    >
      <td className={cn(gutter, inCommentRange && RANGE_MARK)}>{left?.oldNo}</td>
      <Cell line={left} tokens={tokens} side="left" />
      <td className={gutter}>{right?.newNo}</td>
      <Cell line={right} tokens={tokens} side="right" />
    </tr>
  )
}
