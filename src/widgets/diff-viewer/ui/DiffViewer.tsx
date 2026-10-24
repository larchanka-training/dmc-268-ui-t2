import { useMemo } from 'react'
import type { CommentThreadModel } from '@/entities/comment'
import type { DiffFile, DiffFileStatus } from '@/entities/diff'
import { FindingCard, type Finding } from '@/entities/finding'
import { contextRangeKey, useExpandDiffContextStore } from '@/features/expand-diff-context'
import { useAddReviewCommentStore } from '@/features/add-review-comment'
import { Badge } from '@/shared/ui/badge'
import { DiffHunkView } from '@/widgets/diff-viewer/ui/DiffHunkView'
import { getLineAnchor } from '@/widgets/diff-viewer/ui/get-line-anchor'

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

/** Findings render under their last line, like inline review comments on the provider. */
function groupFindingsByLine(file: DiffFile, findings: Finding[]) {
  const shownLines = new Set(
    file.hunks.flatMap((hunk) =>
      hunk.lines.map(getLineAnchor).flatMap((anchor) => (anchor ? [`${anchor.side}:${anchor.lineNumber}`] : [])),
    ),
  )
  const byLine: Record<string, Finding[]> = {}
  const outsideDiff: Finding[] = []
  for (const finding of findings) {
    const key = `${finding.side}:${finding.endLine}`
    if (shownLines.has(key)) {
      byLine[key] = [...(byLine[key] ?? []), finding]
    } else {
      outsideDiff.push(finding)
    }
  }
  return { byLine, outsideDiff }
}

export interface DiffViewerProps {
  file: DiffFile
  threads: CommentThreadModel[]
  /** AI findings for this file (already filtered by the caller). */
  findings?: Finding[]
}

export function DiffViewer({ file, threads, findings = [] }: DiffViewerProps) {
  const threadsByLine = useMemo(
    () => groupThreadsByLine(threads.filter((thread) => thread.filePath === file.filePath)),
    [threads, file.filePath],
  )
  const findingsByLine = useMemo(
    () =>
      groupFindingsByLine(
        file,
        findings.filter((finding) => finding.path === file.filePath),
      ),
    [file, findings],
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
            findingsByLine={findingsByLine.byLine}
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

      {findingsByLine.outsideDiff.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-border px-3 py-2" aria-label="Замечания вне диффа">
          <p className="text-xs font-medium text-muted-foreground">Замечания к строкам вне показанного диффа</p>
          {findingsByLine.outsideDiff.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </section>
      )}
    </div>
  )
}
