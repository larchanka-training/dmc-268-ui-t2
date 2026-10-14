import type { DiffFile } from '@/entities/diff'
import type { AnchoredComments } from '@/widgets/diff-viewer/model/anchor-comments'
import type { ViewMode } from '@/widgets/diff-viewer/model/view-mode'
import { DiffFileSection } from '@/widgets/diff-viewer/ui/DiffFileSection'
import { OutOfDiffComments } from '@/widgets/diff-viewer/ui/OutOfDiffComments'

export interface DiffViewerProps {
  files: DiffFile[]
  anchored: AnchoredComments
  viewMode: ViewMode
}

export function DiffViewer({ files, anchored, viewMode }: DiffViewerProps) {
  return (
    <div className="space-y-4">
      {files.map((file) => (
        <DiffFileSection key={file.path} file={file} anchored={anchored} viewMode={viewMode} />
      ))}
      {anchored.orphans.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <OutOfDiffComments comments={anchored.orphans} testId="out-of-diff-pr" showFilePath />
        </div>
      )}
    </div>
  )
}
