import { Fragment } from 'react'
import { UNIFIED_COLUMNS, UnifiedColGroup, UnifiedLineRow, type DiffHunk, type HunkTokens } from '@/entities/diff'
import type { AnchoredComments } from '@/widgets/diff-viewer/model/anchor-comments'
import { commentsForRow } from '@/widgets/diff-viewer/model/anchor-comments'
import { groupHunks } from '@/widgets/diff-viewer/model/hunk-groups'
import { CommentRow } from '@/widgets/diff-viewer/ui/CommentRow'
import { GapRow } from '@/widgets/diff-viewer/ui/GapRow'
import { HunkHeaderRow } from '@/widgets/diff-viewer/ui/HunkHeaderRow'

export interface UnifiedDiffProps {
  hunks: DiffHunk[]
  tokens: HunkTokens[]
  byLine: AnchoredComments['byLine']
  rangeLines: AnchoredComments['rangeLines']
  openGapKeys: ReadonlySet<string>
  onOpenGap: (key: string) => void
  forceOpen?: boolean
}

export function UnifiedDiff({
  hunks,
  tokens,
  byLine,
  rangeLines,
  openGapKeys,
  onOpenGap,
  forceOpen = false,
}: UnifiedDiffProps) {
  const blocks = forceOpen
    ? hunks.map((_, index) => ({ kind: 'hunk' as const, index }))
    : groupHunks(hunks, byLine, openGapKeys)

  return (
    <table
      data-testid="diff-table"
      data-view="unified"
      className="w-full table-fixed border-collapse font-mono text-[13px]"
    >
      <UnifiedColGroup />
      <tbody>
        {blocks.map((block) =>
          block.kind === 'gap' ? (
            <GapRow key={block.key} rows={block.rows} colSpan={UNIFIED_COLUMNS} onOpen={() => onOpenGap(block.key)} />
          ) : (
            <Fragment key={block.index}>
              <HunkHeaderRow header={hunks[block.index].header} colSpan={UNIFIED_COLUMNS} />
              {hunks[block.index].lines.map((line, lineIndex) => {
                const comments = commentsForRow(byLine, [line])
                return (
                  <Fragment key={lineIndex}>
                    <UnifiedLineRow
                      line={line}
                      tokens={tokens[block.index].get(line)}
                      inCommentRange={rangeLines.has(line)}
                    />
                    {comments.length > 0 && <CommentRow comments={comments} colSpan={UNIFIED_COLUMNS} />}
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
