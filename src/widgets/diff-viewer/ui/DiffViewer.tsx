import { useMemo } from 'react'
import type { CommentThreadModel } from '@/entities/comment'
import type { DiffFile, DiffFileStatus } from '@/entities/diff'
import { contextRangeKey, useExpandDiffContextStore } from '@/features/expand-diff-context'
import { useAddReviewCommentStore } from '@/features/add-review-comment'
import { Badge } from '@/shared/ui/badge'
import { DiffHunkView } from '@/widgets/diff-viewer/ui/DiffHunkView'

const statusVariant: Record<DiffFileStatus, 'default' | 'secondary' | 'destructive' | 'success'> = {
  added: 'success',
  modified: 'secondary',
  removed: 'destructive',
  renamed: 'default',
}

function groupThreadsByLine(threads: CommentThreadModel[]) {
  const map: Record<string, CommentThreadModel[]> = {}
  for (const thread of threads) {
    const key = `${thread.anchorLine.side}:${thread.anchorLine.lineNumber}`
    map[key] = [...(map[key] ?? []), thread]
  }
  return map
}

export interface DiffViewerProps {
  file: DiffFile
  threads: CommentThreadModel[]
}

export function DiffViewer({ file, threads }: DiffViewerProps) {
  const threadsByLine = useMemo(
    () => groupThreadsByLine(threads.filter((thread) => thread.filePath === file.filePath)),
    [threads, file.filePath],
  )

  const expandedRanges = useExpandDiffContextStore((state) => state.expandedRanges)
  const expandContext = useExpandDiffContextStore((state) => state.expandContext)

  const draft = useAddReviewCommentStore((state) => state.draft)
  const openComposer = useAddReviewCommentStore((state) => state.openComposer)
  const updateDraftText = useAddReviewCommentStore((state) => state.updateDraftText)
  const closeComposer = useAddReviewCommentStore((state) => state.closeComposer)

  const draftForFile = draft?.filePath === file.filePath ? draft : null

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
        <span className="font-mono text-sm">{file.filePath}</span>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[file.status]}>{file.status}</Badge>
          <span className="text-xs font-medium text-diff-add-fg">+{file.additions}</span>
          <span className="text-xs font-medium text-diff-del-fg">-{file.deletions}</span>
        </div>
      </div>

      <div>
        {file.hunks.map((hunk) => (
          <DiffHunkView
            key={hunk.id}
            filePath={file.filePath}
            hunk={hunk}
            threadsByLine={threadsByLine}
            draft={draftForFile}
            isContextExpanded={(direction) =>
              Boolean(expandedRanges[contextRangeKey(file.filePath, hunk.id, direction)])
            }
            onExpandContext={(direction) => expandContext(contextRangeKey(file.filePath, hunk.id, direction))}
            onStartComment={(side, lineNumber) => openComposer({ filePath: file.filePath, side, lineNumber })}
            onChangeDraftText={updateDraftText}
            onCancelDraft={closeComposer}
            onSubmitDraft={() => {
              // На этапе мока — просто закрываем композер. Реальная отправка
              // будет добавлена вместе с мутацией entities/comment.
              closeComposer()
            }}
          />
        ))}
      </div>
    </div>
  )
}
