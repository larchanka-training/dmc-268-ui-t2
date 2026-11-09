import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import type { DiffFile } from '@/entities/diff'
import {
  ReviewNotFoundError,
  isReviewSettled,
  useDiffQuery,
  useLiveReview,
  usePullRequestQuery,
  useReviewCommentsQuery,
} from '@/entities/pull-request'
import { countBySeverity, sortBySeverity, type Severity } from '@/entities/review-comment'
import {
  EMPTY_FINDING_FILTERS,
  FindingFiltersPanel,
  filterFindings,
  hasActiveFindingFilters,
  useFindingFilters,
  withFindingFilters,
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
  commentWalk,
  fileOfComments,
  firstCommentIdBySeverity,
  useCollapsedFilesStore,
} from '@/widgets/diff-viewer'
import { useHashTarget, type JumpState } from '@/pages/pull-request/model/useHashTarget'
import { useViewMode } from '@/pages/pull-request/model/useViewMode'
import { DiffPending, EmptyDiff, PageError, PageLoading } from '@/pages/pull-request/ui/PageStates'
import { ReviewNotFound } from '@/pages/pull-request/ui/ReviewNotFound'

const NO_COMMENTS: never[] = []
const NO_FILES: DiffFile[] = []

function remarkWord(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'замечаний'
  if (mod10 === 1) return 'замечание'
  if (mod10 >= 2 && mod10 <= 4) return 'замечания'
  return 'замечаний'
}

function walkLabel(index: number | null, total: number): string {
  if (index === null) return `${total} ${remarkWord(total)}`
  return `${index + 1} из ${total}`
}

function commentIdFromHash(hash: string): string | null {
  if (!hash.startsWith('#comment-')) return null
  try {
    return decodeURIComponent(hash.slice('#comment-'.length))
  } catch {
    return null
  }
}

function reviewFilePaths(
  files: readonly DiffFile[],
  comments: readonly { filePath: string; severity: Severity }[],
): string[] {
  const diffPaths = files.map((file) => file.path)
  const inDiff = new Set(diffPaths)
  const orphans: string[] = []
  const seen = new Set<string>()
  for (const comment of sortBySeverity(comments.filter((item) => !inDiff.has(item.filePath)))) {
    if (seen.has(comment.filePath)) continue
    seen.add(comment.filePath)
    orphans.push(comment.filePath)
  }
  return [...diffPaths, ...orphans]
}

export function PullRequestPage() {
  const { reviewId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { search, hash } = location
  const [viewMode, setViewMode] = useViewMode()

  const { query: reviewQuery, transport } = useLiveReview(reviewId)
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
  const allFiles = diffQuery.data ?? NO_FILES
  const anchored = useMemo(() => anchorComments(allFiles, comments), [allFiles, comments])
  const files = useMemo(() => allFiles.filter((file) => commentCountForFile(file, anchored) > 0), [allFiles, anchored])
  const openedWithoutComments = useMemo(() => {
    if (filters.path === null || files.some((file) => file.path === filters.path)) return null
    return allFiles.find((file) => file.path === filters.path) ?? null
  }, [allFiles, files, filters.path])
  const diffFiles = openedWithoutComments ? [openedWithoutComments] : files
  const counts = useMemo(
    () => countBySeverity(filterFindings(allComments, { ...filters, severity: null })),
    [allComments, filters],
  )
  const fileOfComment = useMemo(() => fileOfComments(files, anchored), [files, anchored])
  const walk = useMemo(() => commentWalk(files, anchored, viewMode), [files, anchored, viewMode])
  const hashId = commentIdFromHash(hash)
  const currentIndex = hashId === null ? -1 : walk.indexOf(hashId)

  const queries = [reviewQuery, diffQuery, commentsQuery]
  // PR — необязательная часть шапки: закрытый PR или сбой GitHub не ломают страницу
  const isReady = queries.every((query) => query.isSuccess) && !prQuery.isPending
  useHashTarget({ ready: isReady, fileOfComment })

  useEffect(() => {
    if (!isReady || hashId === null || walk.includes(hashId)) return
    navigate({ search, hash: '' }, { replace: true, state: location.state })
  }, [isReady, hashId, walk, navigate, search, location.state])

  if (reviewQuery.error instanceof ReviewNotFoundError) return <ReviewNotFound reviewId={reviewId} />
  // Ошибка фонового обновления (опрос, смена статуса) не прячет уже загруженную страницу
  if (queries.some((query) => query.isLoadingError)) return <PageError />
  if (!isReady || !reviewQuery.data) return <PageLoading />

  const goToComment = (id: string) => {
    const state: JumpState = { jump: Date.now() }
    navigate({ search, hash: `#comment-${id}` }, { state })
  }

  const selectSeverity = (severity: Severity) => {
    if (filters.severity === severity) {
      const params = withFindingFilters(new URLSearchParams(search), { ...filters, severity: null })
      const state: JumpState = { jump: Date.now() }
      navigate({ search: `?${params.toString()}`, hash }, { state })
      return
    }
    const nextFilters = { ...filters, severity }
    const nextComments = filterFindings(allComments, nextFilters)
    const nextAnchored = anchorComments(allFiles, nextComments)
    const nextFiles = allFiles.filter((file) => commentCountForFile(file, nextAnchored) > 0)
    const id = firstCommentIdBySeverity(nextFiles, nextAnchored)[severity]
    const params = withFindingFilters(new URLSearchParams(search), nextFilters)
    const state: JumpState = { jump: Date.now() }
    navigate({ search: `?${params.toString()}`, hash: id ? `#comment-${id}` : '' }, { state })
  }

  const review = reviewQuery.data
  const analysisDone = review.status === 'COMPLETED' || review.status === 'PARTIAL'

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <PullRequestHeader
        review={review}
        pullRequest={prQuery.data ?? null}
        counts={counts}
        onSelectSeverity={selectSeverity}
        walkLabel={walkLabel(currentIndex >= 0 ? currentIndex : null, walk.length)}
        onPrev={() => {
          if (currentIndex > 0) goToComment(walk[currentIndex - 1])
        }}
        onNext={() => {
          const id = currentIndex < 0 ? walk[0] : walk[currentIndex + 1]
          if (id) goToComment(id)
        }}
        prevDisabled={currentIndex <= 0}
        nextDisabled={walk.length === 0 || currentIndex === walk.length - 1}
        activeSeverity={filters.severity}
      />

      <ReviewProgress review={review} transport={transport} settled={isReviewSettled(review)} />

      {allComments.length === 0 && analysisDone && (
        <p className="text-sm text-muted-foreground">AI не нашёл замечаний.</p>
      )}
      {(allComments.length > 0 || allFiles.length > 0) && (
        <FindingFiltersPanel
          findings={allComments}
          filePaths={reviewFilePaths(allFiles, allComments)}
          filters={filters}
          onChange={(next) => {
            if (next.path === filters.path) {
              const params = withFindingFilters(new URLSearchParams(search), next)
              const nextSearch = params.toString()
              navigate({ search: nextSearch ? `?${nextSearch}` : '', hash }, { replace: true, state: location.state })
              return
            }
            const params = withFindingFilters(new URLSearchParams(search), next)
            if (next.path === null) {
              navigate({ search: `?${params.toString()}`, hash })
              return
            }
            const nextAnchored = anchorComments(allFiles, filterFindings(allComments, next))
            const chosen = allFiles.find((file) => file.path === next.path)
            const id = chosen ? commentWalk([chosen], nextAnchored, viewMode)[0] : undefined
            const state: JumpState = { jump: Date.now() }
            navigate({ search: `?${params.toString()}`, hash: id ? `#comment-${id}` : '' }, { state })
          }}
        />
      )}

      {isFiltered && diffFiles.length === 0 && anchored.orphans.length === 0 && allFiles.length > 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-6">
          <p className="text-sm text-muted-foreground">Нет замечаний, подходящих под фильтры.</p>
          <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FINDING_FILTERS)}>
            Сбросить фильтры
          </Button>
        </div>
      ) : allFiles.length === 0 ? (
        <>
          {diffQuery.data === null ? <DiffPending /> : <EmptyDiff />}
          <DiffViewer files={[]} anchored={anchored} viewMode={viewMode} />
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <h2 className="mb-2 text-sm font-semibold">Файлы ({files.length})</h2>
            <FileList
              items={files.map((file) => ({
                file,
                commentCount: commentCountForFile(file, anchored),
                firstCommentId: walk.find((id) => fileOfComment.get(id) === file.path) ?? '',
              }))}
            />
          </aside>
          <main className="min-w-0 space-y-3">
            <div className="flex justify-end">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            <DiffViewer
              files={diffFiles}
              anchored={anchored}
              viewMode={viewMode}
              forceOpenPath={openedWithoutComments?.path ?? null}
              filterKey={`${filters.severity ?? ''}|${filters.query}|${filters.path ?? ''}`}
            />
          </main>
        </div>
      )}
    </div>
  )
}
