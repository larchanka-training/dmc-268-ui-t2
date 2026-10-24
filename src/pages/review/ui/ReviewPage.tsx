import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useCommentThreadsQuery } from '@/entities/comment'
import { useReviewDiffQuery } from '@/entities/diff'
import { useReviewFindingsQuery } from '@/entities/finding'
import { isReviewSettled, useLiveReview, type ReviewStatus } from '@/entities/review'
import {
  EMPTY_FINDING_FILTERS,
  filterFindings,
  FindingFiltersPanel,
  hasActiveFindingFilters,
  useFindingFilters,
} from '@/features/filter-findings'
import { ApiHttpError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { DiffViewer } from '@/widgets/diff-viewer'
import { ReviewProgress } from '@/widgets/review-progress'

/** Review served by the dev MSW mocks; `/review` opens it so the screen is reachable locally. */
export const DEMO_REVIEW_ID = 'demo-review'

const DIFF_NOT_CAPTURED: ReadonlySet<ReviewStatus> = new Set(['QUEUED', 'FETCHING_DIFF'])

function httpStatus(error: unknown): number | null {
  return error instanceof ApiHttpError ? error.status : null
}

function ReviewScreen({ reviewId }: { reviewId: string }) {
  const { query: reviewQuery, transport } = useLiveReview(reviewId)
  const review = reviewQuery.data
  const settled = review ? isReviewSettled(review) : false
  const analysisDone = review?.status === 'COMPLETED' || review?.status === 'PARTIAL'

  const diffQuery = useReviewDiffQuery(reviewId, {
    enabled: review !== undefined && !DIFF_NOT_CAPTURED.has(review.status),
  })
  const findingsQuery = useReviewFindingsQuery(reviewId, { enabled: analysisDone })
  const commentsQuery = useCommentThreadsQuery(reviewId)

  // The diff can be requested a moment before the backend stores it; retry a 404 on the next status.
  const diffMissing = httpStatus(diffQuery.error) === 404
  const refetchDiff = diffQuery.refetch
  useEffect(() => {
    if (diffMissing) {
      void refetchDiff()
    }
  }, [diffMissing, refetchDiff, review?.status])

  const [filters, setFilters] = useFindingFilters()
  const allFindings = useMemo(() => findingsQuery.data ?? [], [findingsQuery.data])
  const shownFindings = useMemo(() => filterFindings(allFindings, filters), [allFindings, filters])
  // URL filters (e.g. a shared link) apply only once findings exist; before that, show the whole diff.
  const isFiltered = hasActiveFindingFilters(filters) && findingsQuery.isSuccess

  const files = useMemo(() => {
    const diffFiles = diffQuery.data ?? []
    if (!isFiltered) {
      return diffFiles
    }
    const pathsWithFindings = new Set(shownFindings.map((finding) => finding.path))
    return diffFiles.filter((file) => pathsWithFindings.has(file.filePath))
  }, [diffQuery.data, isFiltered, shownFindings])

  if (reviewQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Загрузка ревью...</p>
  }
  if (reviewQuery.isError || !review) {
    return (
      <p className="text-sm text-destructive">
        {httpStatus(reviewQuery.error) === 404 ? 'Ревью не найдено.' : 'Не удалось загрузить ревью.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Pull Request #{review.pullRequestNumber} — Review</h1>

      <ReviewProgress review={review} transport={transport} settled={settled} />

      {review.summary && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{review.summary}</p>}

      {analysisDone && findingsQuery.isSuccess && allFindings.length > 0 && (
        <FindingFiltersPanel
          findings={allFindings}
          filters={filters}
          onChange={setFilters}
          shownCount={shownFindings.length}
        />
      )}
      {analysisDone && findingsQuery.isSuccess && allFindings.length === 0 && (
        <p className="text-sm text-muted-foreground">AI не нашёл замечаний.</p>
      )}
      {analysisDone && findingsQuery.isError && (
        <p className="text-sm text-destructive">Не удалось загрузить замечания.</p>
      )}
      {!analysisDone && !settled && <p className="text-sm text-muted-foreground">Замечания появятся после анализа.</p>}

      {diffQuery.isLoading && <p className="text-sm text-muted-foreground">Загрузка диффа...</p>}
      {diffQuery.isError && (
        <p className="text-sm text-muted-foreground">
          {httpStatus(diffQuery.error) === 410
            ? 'Дифф больше недоступен: срок хранения контекста истёк.'
            : httpStatus(diffQuery.error) === 404
              ? 'Дифф ещё не сохранён.'
              : 'Не удалось загрузить дифф.'}
        </p>
      )}

      {isFiltered && files.length === 0 && diffQuery.isSuccess && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-4 py-6">
          <p className="text-sm text-muted-foreground">Нет замечаний, подходящих под фильтры.</p>
          <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FINDING_FILTERS)}>
            Сбросить фильтры
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {files.map((file) => (
          <DiffViewer key={file.id} file={file} threads={commentsQuery.data ?? []} findings={shownFindings} />
        ))}
      </div>
    </div>
  )
}

export function ReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const resolvedId = reviewId ?? (import.meta.env.DEV ? DEMO_REVIEW_ID : null)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {resolvedId ? (
        <ReviewScreen key={resolvedId} reviewId={resolvedId} />
      ) : (
        <p className="text-sm text-muted-foreground">Откройте ревью по ссылке вида /reviews/&lt;id&gt;.</p>
      )}
    </div>
  )
}
