import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Link } from 'react-router-dom'
import type { DiffFile } from '@/entities/diff'
import {
  DiffExpiredError,
  ReviewNotFoundError,
  isReviewSettled,
  useCancelReviewMutation,
  useDiffQuery,
  useLiveReview,
  usePullRequestQuery,
  useReviewCommentsQuery,
  useStartReviewMutation,
  type ReviewStatus,
} from '@/entities/pull-request'
import { countBySeverity, type Severity } from '@/entities/review-comment'
import {
  EMPTY_FINDING_FILTERS,
  FindingFiltersPanel,
  filterFindings,
  hasActiveFindingFilters,
  useFindingFilters,
} from '@/features/filter-findings'
import { useCommentCardStore } from '@/features/review-comment-card'
import { Button } from '@/shared/ui/button'
import { FileList } from '@/widgets/file-list'
import { PullRequestHeader } from '@/widgets/pr-header'
import { ReviewProgress } from '@/widgets/review-progress'
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
import { DiffExpired, DiffPending, EmptyDiff, PageError, PageLoading } from '@/pages/pull-request/ui/PageStates'
import { ReviewNotFound } from '@/pages/pull-request/ui/ReviewNotFound'

const NO_COMMENTS: never[] = []
const NO_FILES: DiffFile[] = []
const CANCELLABLE_STATUSES: ReadonlySet<ReviewStatus> = new Set([
  'QUEUED',
  'FETCHING_DIFF',
  'PARSING_CONTEXT',
  'LLM_PROCESSING',
])

export function PullRequestPage() {
  const { reviewId = '' } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const [viewMode, setViewMode] = useViewMode()

  const { query: reviewQuery, transport } = useLiveReview(reviewId)
  const cancelMutation = useCancelReviewMutation(reviewId)
  const startMutation = useStartReviewMutation()
  const prQuery = usePullRequestQuery(reviewQuery.data)
  const diffQuery = useDiffQuery(reviewId)
  const commentsQuery = useReviewCommentsQuery(reviewId)

  // UI-состояние (раскрытые карточки и свёрнутые файлы) не должно перетекать между ревью
  useEffect(
    () => () => {
      useCommentCardStore.setState(useCommentCardStore.getInitialState(), true)
      useCollapsedFilesStore.setState(useCollapsedFilesStore.getInitialState(), true)
    },
    [reviewId],
  )

  const [filters, setFilters] = useFindingFilters()
  const isFiltered = hasActiveFindingFilters(filters)
  const allComments = commentsQuery.data ?? NO_COMMENTS
  const comments = useMemo(() => filterFindings(allComments, filters), [allComments, filters])
  const diffExpired = diffQuery.error instanceof DiffExpiredError
  const allFiles = diffExpired ? NO_FILES : (diffQuery.data ?? NO_FILES)
  const anchored = useMemo(() => anchorComments(allFiles, comments), [allFiles, comments])
  // С фильтрами показываем только файлы, где остались замечания
  const files = useMemo(
    () => (isFiltered ? allFiles.filter((file) => commentCountForFile(file, anchored) > 0) : allFiles),
    [allFiles, anchored, isFiltered],
  )
  const counts = useMemo(() => countBySeverity(comments), [comments])
  const firstBySeverity = useMemo(() => firstCommentIdBySeverity(files, anchored), [files, anchored])
  const fileOfComment = useMemo(() => fileOfComments(files, anchored), [files, anchored])

  const queries = [reviewQuery, commentsQuery]
  // PR — необязательная часть шапки: закрытый PR или сбой GitHub не ломают страницу
  const isReady =
    queries.every((query) => query.isSuccess) && (diffQuery.isSuccess || diffExpired) && !prQuery.isPending
  useHashTarget({ ready: isReady, fileOfComment })

  if (reviewQuery.error instanceof ReviewNotFoundError) return <ReviewNotFound reviewId={reviewId} />
  // Ошибки diff, в том числе при обновлении, показываем явно; ожидаемый 410 сохраняет результаты.
  if (queries.some((query) => query.isLoadingError) || (diffQuery.isError && !diffExpired)) return <PageError />
  if (!isReady || !reviewQuery.data) return <PageLoading />

  const selectSeverity = (severity: Severity) => {
    const id = firstBySeverity[severity]
    if (!id) return
    const state: JumpState = { jump: Date.now() }
    navigate({ search, hash: `#comment-${id}` }, { state })
  }

  const review = reviewQuery.data
  const analysisDone = review.status === 'COMPLETED' || review.status === 'PARTIAL'
  const openPullRequest = prQuery.isSuccess ? prQuery.data : null
  const showStop = CANCELLABLE_STATUSES.has(review.status)
  const showRunAgain = isReviewSettled(review) && openPullRequest !== null

  async function handleStop() {
    try {
      await cancelMutation.mutateAsync()
    } catch {
      // The open review stays on screen; a later refresh still shows its status.
    }
  }

  async function handleRunAgain() {
    if (!openPullRequest) return
    try {
      const nextReviewId = await startMutation.mutateAsync({
        repositoryId: review.repositoryId,
        number: review.pullRequestNumber,
        headSha: openPullRequest.headSha,
        rerun_of: review.id,
      })
      navigate(`/reviews/${encodeURIComponent(nextReviewId)}`)
    } catch {
      // Stay on this review when the start call fails.
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <Link className="text-sm text-primary underline" to="/reviews">
        Back to reviews
      </Link>
      <PullRequestHeader
        review={review}
        pullRequest={prQuery.data ?? null}
        counts={counts}
        onSelectSeverity={selectSeverity}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <ReviewProgress review={review} transport={transport} settled={isReviewSettled(review)} />
        </div>
        {showStop || showRunAgain ? (
          <div className="flex shrink-0 gap-2">
            {showStop ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cancelMutation.isPending}
                onClick={() => void handleStop()}
              >
                Stop
              </Button>
            ) : null}
            {showRunAgain ? (
              <Button type="button" size="sm" disabled={startMutation.isPending} onClick={() => void handleRunAgain()}>
                Run again
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {allComments.length > 0 ? (
        <FindingFiltersPanel
          findings={allComments}
          filters={filters}
          onChange={setFilters}
          shownCount={comments.length}
        />
      ) : (
        analysisDone && <p className="text-sm text-muted-foreground">AI не нашёл замечаний.</p>
      )}

      {isFiltered && files.length === 0 && anchored.orphans.length === 0 && allFiles.length > 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-6">
          <p className="text-sm text-muted-foreground">Нет замечаний, подходящих под фильтры.</p>
          <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FINDING_FILTERS)}>
            Сбросить фильтры
          </Button>
        </div>
      ) : allFiles.length === 0 ? (
        <>
          {diffExpired ? <DiffExpired /> : diffQuery.data === null ? <DiffPending /> : <EmptyDiff />}
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
