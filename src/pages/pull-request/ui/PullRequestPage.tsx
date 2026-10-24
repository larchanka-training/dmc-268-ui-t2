import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { parseUnifiedDiff } from '@/entities/diff'
import {
  PullRequestNotFoundError,
  useDiffQuery,
  usePullRequestQuery,
  useReviewCommentsQuery,
} from '@/entities/pull-request'
import { countBySeverity, type Severity } from '@/entities/review-comment'
import { useCommentCardStore } from '@/features/review-comment-card'
import { FileList } from '@/widgets/file-list'
import { PullRequestHeader } from '@/widgets/pr-header'
import {
  DiffViewer,
  ViewModeToggle,
  anchorComments,
  commentCountForFile,
  fileOfComments,
  firstCommentIdBySeverity,
  useCollapsedFilesStore,
} from '@/widgets/diff-viewer'
import { useHashTarget, type JumpState } from '@/pages/pull-request/model/useHashTarget'
import { useViewMode } from '@/pages/pull-request/model/useViewMode'
import { EmptyDiff, PageError, PageLoading } from '@/pages/pull-request/ui/PageStates'
import { PullRequestNotFound } from '@/pages/pull-request/ui/PullRequestNotFound'

const NO_COMMENTS: never[] = []

export function PullRequestPage() {
  const { prId = '' } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const [viewMode, setViewMode] = useViewMode()

  const prQuery = usePullRequestQuery(prId)
  const diffQuery = useDiffQuery(prId)
  const commentsQuery = useReviewCommentsQuery(prId)

  // UI-состояние (раскрытые карточки и свёрнутые файлы) не должно перетекать между PR
  useEffect(
    () => () => {
      useCommentCardStore.setState(useCommentCardStore.getInitialState(), true)
      useCollapsedFilesStore.setState(useCollapsedFilesStore.getInitialState(), true)
    },
    [prId],
  )

  const comments = commentsQuery.data ?? NO_COMMENTS
  const files = useMemo(() => parseUnifiedDiff(diffQuery.data ?? ''), [diffQuery.data])
  const anchored = useMemo(() => anchorComments(files, comments), [files, comments])
  const counts = useMemo(() => countBySeverity(comments), [comments])
  const firstBySeverity = useMemo(() => firstCommentIdBySeverity(files, anchored), [files, anchored])
  const fileOfComment = useMemo(() => fileOfComments(files, anchored), [files, anchored])

  const queries = [prQuery, diffQuery, commentsQuery]
  const isReady = queries.every((query) => query.isSuccess)
  useHashTarget({ ready: isReady, fileOfComment })

  if (queries.some((query) => query.error instanceof PullRequestNotFoundError)) {
    return <PullRequestNotFound prId={prId} />
  }
  if (queries.some((query) => query.isError)) return <PageError />
  if (!isReady || !prQuery.data) return <PageLoading />

  const selectSeverity = (severity: Severity) => {
    const id = firstBySeverity[severity]
    if (!id) return
    const state: JumpState = { jump: Date.now() }
    navigate({ search, hash: `#comment-${id}` }, { state })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <PullRequestHeader pullRequest={prQuery.data} counts={counts} onSelectSeverity={selectSeverity} />

      {files.length === 0 ? (
        <>
          <EmptyDiff />
          <DiffViewer files={[]} anchored={anchored} viewMode={viewMode} />
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <h2 className="mb-2 text-sm font-semibold">Файлы ({files.length})</h2>
            <FileList items={files.map((file) => ({ file, commentCount: commentCountForFile(file, anchored) }))} />
          </aside>
          <main className="min-w-0 space-y-3">
            <div className="flex justify-end">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            <DiffViewer files={files} anchored={anchored} viewMode={viewMode} />
          </main>
        </div>
      )}
    </div>
  )
}
