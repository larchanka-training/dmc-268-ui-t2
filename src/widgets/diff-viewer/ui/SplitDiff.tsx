import { Fragment, useMemo } from 'react'
import { SPLIT_COLUMNS, SplitLineRow, buildSplitRows, type DiffHunk, type HunkTokens } from '@/entities/diff'
import type { AnchoredComments } from '@/widgets/diff-viewer/model/anchor-comments'
import { commentsForRow } from '@/widgets/diff-viewer/model/anchor-comments'
import { CommentRow } from '@/widgets/diff-viewer/ui/CommentRow'
import { HunkHeaderRow } from '@/widgets/diff-viewer/ui/HunkHeaderRow'

export interface SplitDiffProps {
  hunks: DiffHunk[]
  tokens: HunkTokens[]
  byLine: AnchoredComments['byLine']
  rangeLines: AnchoredComments['rangeLines']
}

export function SplitDiff({ hunks, tokens, byLine, rangeLines }: SplitDiffProps) {
  const rowsByHunk = useMemo(() => hunks.map((hunk) => buildSplitRows(hunk.lines)), [hunks])

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
        {hunks.map((hunk, hunkIndex) => (
          <Fragment key={hunkIndex}>
            <HunkHeaderRow header={hunk.header} colSpan={SPLIT_COLUMNS} />
            {rowsByHunk[hunkIndex].map((row, rowIndex) => {
              const comments = commentsForRow(byLine, [row.left, row.right])
              return (
                <Fragment key={rowIndex}>
                  <SplitLineRow
                    row={row}
                    tokens={tokens[hunkIndex]}
                    inCommentRange={[row.left, row.right].some((cell) => cell !== null && rangeLines.has(cell))}
                  />
                  {comments.length > 0 && <CommentRow comments={comments} colSpan={SPLIT_COLUMNS} />}
                </Fragment>
              )
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}
