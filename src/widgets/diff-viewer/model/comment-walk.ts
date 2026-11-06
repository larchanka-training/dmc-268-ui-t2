import { buildSplitRows, type DiffFile } from '@/entities/diff'
import type { AnchoredComments } from '@/widgets/diff-viewer/model/anchor-comments'
import { commentsForRow } from '@/widgets/diff-viewer/model/anchor-comments'
import type { ViewMode } from '@/widgets/diff-viewer/model/view-mode'

/** Comment ids in the order the active diff view renders their cards. */
export function commentWalk(files: readonly DiffFile[], anchored: AnchoredComments, viewMode: ViewMode): string[] {
  const ids: string[] = []
  const push = (comments: readonly { id: string }[] | undefined) => {
    for (const comment of comments ?? []) ids.push(comment.id)
  }

  for (const file of files) {
    for (const hunk of file.hunks) {
      if (viewMode === 'split') {
        for (const row of buildSplitRows(hunk.lines)) {
          push(commentsForRow(anchored.byLine, [row.left, row.right]))
        }
      } else {
        for (const line of hunk.lines) push(commentsForRow(anchored.byLine, [line]))
      }
    }
    push(anchored.outOfDiffByFile.get(file.path))
  }
  push(anchored.orphans)
  return ids
}
