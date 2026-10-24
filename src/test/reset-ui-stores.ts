import { useCommentCardStore } from '@/features/review-comment-card'
import { useCollapsedFilesStore } from '@/widgets/diff-viewer'

export function resetUiStores() {
  useCommentCardStore.setState(useCommentCardStore.getInitialState(), true)
  useCollapsedFilesStore.setState(useCollapsedFilesStore.getInitialState(), true)
}
