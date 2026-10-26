import { Fragment } from 'react'
import { UNIFIED_COLUMNS, UnifiedColGroup, UnifiedLineRow, type DiffHunk, type HunkTokens } from '@/entities/diff'
import type { AnchoredComments } from '@/widgets/diff-viewer/model/anchor-comments'
import { commentsForRow } from '@/widgets/diff-viewer/model/anchor-comments'
import { CommentRow } from '@/widgets/diff-viewer/ui/CommentRow'
import { HunkHeaderRow } from '@/widgets/diff-viewer/ui/HunkHeaderRow'

export interface UnifiedDiffProps {
  hunks: DiffHunk[]
  tokens: HunkTokens[]
  byLine: AnchoredComments['byLine']
  rangeLines: AnchoredComments['rangeLines']
}

export function UnifiedDiff({ hunks, tokens, byLine, rangeLines }: UnifiedDiffProps) {
  return (
    <table
      data-testid="diff-table"
      data-view="unified"
      className="w-full table-fixed border-collapse font-mono text-[13px]"
    >
      <UnifiedColGroup />
      <tbody>
        {hunks.map((hunk, hunkIndex) => (
          <Fragment key={hunkIndex}>
            <HunkHeaderRow header={hunk.header} colSpan={UNIFIED_COLUMNS} />
            {hunk.lines.map((line, lineIndex) => {
              const comments = commentsForRow(byLine, [line])
              return (
                <Fragment key={lineIndex}>
                  <UnifiedLineRow
                    line={line}
                    tokens={tokens[hunkIndex].get(line)}
                    inCommentRange={rangeLines.has(line)}
                  />
                  {comments.length > 0 && <CommentRow comments={comments} colSpan={UNIFIED_COLUMNS} />}
                </Fragment>
              )
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}
