import { ChevronsDown, ChevronsUp } from 'lucide-react'
import type { CommentThreadModel } from '@/entities/comment'
import { CommentThread } from '@/entities/comment'
import type { ContextGap, DiffHunk } from '@/entities/diff'
import { useDiffContextQuery } from '@/entities/diff'
import type { CommentDraft } from '@/features/add-review-comment'
import { CommentComposer } from '@/features/add-review-comment'
import { Button } from '@/shared/ui/button'
import { DiffLineRow } from '@/widgets/diff-viewer/ui/DiffLineRow'
import { getLineAnchor } from '@/widgets/diff-viewer/ui/get-line-anchor'

function threadKey(side: 'old' | 'new', lineNumber: number) {
  return `${side}:${lineNumber}`
}

interface ContextGapRowProps {
  filePath: string
  hunkId: string
  direction: 'before' | 'after'
  gap: ContextGap
  isExpanded: boolean
  onExpand: () => void
}

function ContextGapRow({ filePath, hunkId, direction, gap, isExpanded, onExpand }: ContextGapRowProps) {
  const contextQuery = useDiffContextQuery(filePath, hunkId, direction, gap.startLine, gap.lineCount, isExpanded)

  if (!isExpanded) {
    return (
      <div className="flex items-center gap-2 border-y border-border bg-muted px-2 py-1">
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={onExpand}>
          {direction === 'before' ? <ChevronsUp className="h-3 w-3" /> : <ChevronsDown className="h-3 w-3" />}
          Показать ещё {gap.lineCount} строк
        </Button>
      </div>
    )
  }

  if (contextQuery.isLoading) {
    return <div className="px-2 py-1 text-xs text-muted-foreground">Загрузка контекста...</div>
  }

  return (
    <div>
      {(contextQuery.data ?? []).map((line) => (
        <DiffLineRow key={line.id} line={line} hasThread={false} onStartComment={() => {}} />
      ))}
    </div>
  )
}

export interface DiffHunkViewProps {
  filePath: string
  hunk: DiffHunk
  threadsByLine: Record<string, CommentThreadModel[]>
  draft: CommentDraft | null
  isContextExpanded: (direction: 'before' | 'after') => boolean
  onExpandContext: (direction: 'before' | 'after') => void
  onStartComment: (side: 'old' | 'new', lineNumber: number) => void
  onChangeDraftText: (text: string) => void
  onCancelDraft: () => void
  onSubmitDraft: (text: string) => void
}

export function DiffHunkView({
  filePath,
  hunk,
  threadsByLine,
  draft,
  isContextExpanded,
  onExpandContext,
  onStartComment,
  onChangeDraftText,
  onCancelDraft,
  onSubmitDraft,
}: DiffHunkViewProps) {
  return (
    <div>
      {hunk.contextBefore && (
        <ContextGapRow
          filePath={filePath}
          hunkId={hunk.id}
          direction="before"
          gap={hunk.contextBefore}
          isExpanded={isContextExpanded('before')}
          onExpand={() => onExpandContext('before')}
        />
      )}

      <div className="bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{hunk.header}</div>

      {hunk.lines.map((line) => {
        const anchor = getLineAnchor(line)
        const key = anchor ? threadKey(anchor.side, anchor.lineNumber) : null
        const threads = key ? threadsByLine[key] : undefined
        const isDraftHere =
          draft !== null && anchor !== null && draft.side === anchor.side && draft.lineNumber === anchor.lineNumber

        return (
          <div key={line.id}>
            <DiffLineRow
              line={line}
              hasThread={Boolean(threads?.length) || isDraftHere}
              onStartComment={() => anchor && onStartComment(anchor.side, anchor.lineNumber)}
            />
            {threads?.map((thread) => (
              <div key={thread.id} className="border-b border-border px-10 py-2">
                <CommentThread thread={thread} />
              </div>
            ))}
            {isDraftHere && draft && (
              <div className="border-b border-border px-10 py-2">
                <CommentComposer
                  draft={draft}
                  onChangeText={onChangeDraftText}
                  onCancel={onCancelDraft}
                  onSubmit={onSubmitDraft}
                />
              </div>
            )}
          </div>
        )
      })}

      {hunk.contextAfter && (
        <ContextGapRow
          filePath={filePath}
          hunkId={hunk.id}
          direction="after"
          gap={hunk.contextAfter}
          isExpanded={isContextExpanded('after')}
          onExpand={() => onExpandContext('after')}
        />
      )}
    </div>
  )
}
