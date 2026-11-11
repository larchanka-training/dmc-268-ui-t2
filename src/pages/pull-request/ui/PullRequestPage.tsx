import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import type { DiffFile } from '@/entities/diff'
import {
  DiffExpiredError,
  PullRequestHttpError,
  ReviewNotFoundError,
  isReviewSettled,
  useCancelReviewMutation,
  useDiffQuery,
  useLiveReview,
  usePullRequestQuery,
  useReviewCommentsQuery,
  useStartReviewMutation,
  type PullRequest,
  type ReviewStatus,
} from '@/entities/pull-request'
import { useMeQuery } from '@/entities/session'
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

function isIntegrationUnhealthy(error: Error): boolean {
  return error instanceof PullRequestHttpError && error.status === 409 && error.code === 'INTEGRATION_UNHEALTHY'
}

export function PullRequestPage() {
  const { reviewId = '' } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const [viewMode, setViewMode] = useViewMode()
  const queryClient = useQueryClient()
  const userId = useMeQuery().data?.user.id
  const [refreshFailed, setRefreshFailed] = useState(false)
  const live = useRef(false)
  const active = useRef({ reviewId, userId })
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  useLayoutEffect(() => {
    active.current = { reviewId, userId }
  }, [reviewId, userId])

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
  const openPullRequest = prQuery.data ?? null
  const showStop = CANCELLABLE_STATUSES.has(review.status)
  const showRunAgain = isReviewSettled(review) && openPullRequest !== null

  async function handleStop() {
    try {
      await cancelMutation.mutateAsync()
    } catch (error) {
      if (error instanceof PullRequestHttpError && error.status === 401) return
      // Error surfaced via cancelMutation.isError below; onSettled still refetches review detail.
    }
  }

  async function handleRunAgain() {
    if (!openPullRequest || userId === undefined) return
    const startedReviewId = review.id
    const startedUserId = userId
    const stillActive = () =>
      live.current && active.current.reviewId === startedReviewId && active.current.userId === startedUserId
    setRefreshFailed(false)
    const prQueryKey = ['pull-request', userId, review.repositoryId, review.pullRequestNumber] as const
    const previousUpdatedAt = queryClient.getQueryState(prQueryKey)?.dataUpdatedAt ?? 0
    try {
      await queryClient.refetchQueries({ queryKey: prQueryKey })
    } catch {
      if (!stillActive()) return
      setRefreshFailed(true)
      return
    }
    if (!stillActive()) return
    const freshPullRequest = queryClient.getQueryData<PullRequest | null>(prQueryKey)
    const updatedAt = queryClient.getQueryState(prQueryKey)?.dataUpdatedAt ?? 0
    // Require a successful write after this refresh; a cancelled GET can leave stale cache data.
    if (
      queryClient.getQueryState(prQueryKey)?.status === 'error' ||
      !freshPullRequest?.headSha ||
      updatedAt <= previousUpdatedAt
    ) {
      setRefreshFailed(true)
      return
    }
    try {
      const nextReviewId = await startMutation.mutateAsync({
        repositoryId: review.repositoryId,
        number: review.pullRequestNumber,
        headSha: freshPullRequest.headSha,
        rerun_of: review.id,
      })
      if (!stillActive()) return
      navigate(`/reviews/${encodeURIComponent(nextReviewId)}`)
    } catch (error) {
      if (error instanceof PullRequestHttpError && error.status === 401) return
      // Error surfaced via startMutation.isError below
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-sm text-primary underline" to="/reviews">
            Back to reviews
          </Link>
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
        {refreshFailed ? (
          <p className="text-xs text-destructive" role="alert">
            Could not start review. Try again.
          </p>
        ) : null}
        {cancelMutation.isError ? (
          <p className="text-xs text-destructive" role="alert">
            Could not stop review. Try again.
          </p>
        ) : null}
        {startMutation.isError ? (
          <p className="text-xs text-destructive" role="alert">
            {isIntegrationUnhealthy(startMutation.error) ? (
              <>
                This repository integration is unhealthy, so new reviews are blocked. An admin can use Check access on
                the{' '}
                <Link to="/repos" className="underline underline-offset-2">
                  Repositories
                </Link>{' '}
                page, then try again.
              </>
            ) : (
              'Could not start review. Try again.'
            )}
          </p>
        ) : null}
      </div>
      <PullRequestHeader
        review={review}
        pullRequest={prQuery.data ?? null}
        counts={counts}
        onSelectSeverity={selectSeverity}
      />

      <ReviewProgress review={review} transport={transport} settled={isReviewSettled(review)} />

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
