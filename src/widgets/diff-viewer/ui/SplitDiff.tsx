import { Fragment, useMemo } from 'react'
import { SPLIT_COLUMNS, SplitLineRow, buildSplitRows, type DiffHunk, type HunkTokens } from '@/entities/diff'
import type { AnchoredComments } from '@/widgets/diff-viewer/model/anchor-comments'
import { commentsForRow } from '@/widgets/diff-viewer/model/anchor-comments'
import { groupHunks } from '@/widgets/diff-viewer/model/hunk-groups'
import { CommentRow } from '@/widgets/diff-viewer/ui/CommentRow'
import { GapRow } from '@/widgets/diff-viewer/ui/GapRow'
import { HunkHeaderRow } from '@/widgets/diff-viewer/ui/HunkHeaderRow'

export interface SplitDiffProps {
  hunks: DiffHunk[]
  tokens: HunkTokens[]
  byLine: AnchoredComments['byLine']
  rangeLines: AnchoredComments['rangeLines']
  openGapKeys: ReadonlySet<string>
  onOpenGap: (key: string) => void
  forceOpen?: boolean
}

export function SplitDiff({
  hunks,
  tokens,
  byLine,
  rangeLines,
  openGapKeys,
  onOpenGap,
  forceOpen = false,
}: SplitDiffProps) {
  const rowsByHunk = useMemo(() => hunks.map((hunk) => buildSplitRows(hunk.lines)), [hunks])
  const blocks = forceOpen
    ? hunks.map((_, index) => ({ kind: 'hunk' as const, index }))
    : groupHunks(hunks, byLine, openGapKeys)

  return (
    <table
      data-testid="diff-table"
      data-view="split"
      className="w-full table-fixed border-collapse font-mono text-[13px]"
    >
      <colgroup>
        <col className="w-12" />
        <col />
        <col className="w-12" />
        <col />
      </colgroup>
      <tbody>
        {blocks.map((block) =>
          block.kind === 'gap' ? (
            <GapRow key={block.key} rows={block.rows} colSpan={SPLIT_COLUMNS} onOpen={() => onOpenGap(block.key)} />
          ) : (
            <Fragment key={block.index}>
              <HunkHeaderRow header={hunks[block.index].header} colSpan={SPLIT_COLUMNS} />
              {rowsByHunk[block.index].map((row, rowIndex) => {
                const comments = commentsForRow(byLine, [row.left, row.right])
                return (
                  <Fragment key={rowIndex}>
                    <SplitLineRow
                      row={row}
                      tokens={tokens[block.index]}
                      inCommentRange={[row.left, row.right].some((cell) => cell !== null && rangeLines.has(cell))}
                    />
                    {comments.length > 0 && <CommentRow comments={comments} colSpan={SPLIT_COLUMNS} />}
                  </Fragment>
                )
              })}
            </Fragment>
          ),
        )}
      </tbody>
    </table>
  )
}
