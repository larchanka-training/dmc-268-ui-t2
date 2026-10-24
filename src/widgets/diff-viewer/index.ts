export { DiffViewer } from '@/widgets/diff-viewer/ui/DiffViewer'
export { ViewModeToggle } from '@/widgets/diff-viewer/ui/ViewModeToggle'
export { useCollapsedFilesStore } from '@/widgets/diff-viewer/model/collapsed-files-store'
export { DEFAULT_VIEW_MODE, parseViewMode, type ViewMode } from '@/widgets/diff-viewer/model/view-mode'
export {
  anchorComments,
  commentCountForFile,
  commentsForRow,
  fileOfComments,
  firstCommentIdBySeverity,
  type AnchoredComments,
} from '@/widgets/diff-viewer/model/anchor-comments'
