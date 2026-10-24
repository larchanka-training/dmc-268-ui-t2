import { AlertTriangle, Check, CircleDashed, Loader2, MinusCircle, Radio, RefreshCw, XCircle } from 'lucide-react'
import {
  getReviewStages,
  type ReviewDetail,
  type ReviewStage,
  type ReviewStageId,
  type ReviewStageState,
  type ReviewStatus,
  type ReviewTransport,
} from '@/entities/review'
import { cn } from '@/shared/lib/cn'

const stageLabel: Record<ReviewStageId, string> = {
  context: 'Сбор контекста',
  analysis: 'Анализ LLM',
  publication: 'Публикация',
}

const stateLabel: Record<ReviewStageState, string> = {
  pending: 'ожидает',
  active: 'выполняется',
  done: 'готово',
  partial: 'частично',
  failed: 'ошибка',
  skipped: 'пропущено',
}

const statusLabel: Record<ReviewStatus, string> = {
  QUEUED: 'В очереди',
  FETCHING_DIFF: 'Загрузка диффа',
  PARSING_CONTEXT: 'Разбор контекста',
  LLM_PROCESSING: 'Анализ моделью',
  COMPLETED: 'Анализ завершён',
  PARTIAL: 'Анализ завершён частично',
  FAILED: 'Ошибка ревью',
  SKIPPED: 'Ревью пропущено',
}

const circleClass: Record<ReviewStageState, string> = {
  pending: 'border-border bg-background text-muted-foreground',
  active: 'border-primary bg-background text-foreground',
  done: 'border-transparent bg-diff-add-fg text-background',
  partial: 'border-transparent bg-diff-del-bg text-diff-del-fg',
  failed: 'border-transparent bg-destructive text-destructive-foreground',
  skipped: 'border-border bg-muted text-muted-foreground',
}

function StageIcon({ state }: { state: ReviewStageState }) {
  const className = 'h-3.5 w-3.5'
  switch (state) {
    case 'active':
      return <Loader2 className={cn(className, 'animate-spin')} aria-hidden />
    case 'done':
      return <Check className={className} aria-hidden />
    case 'partial':
      return <AlertTriangle className={className} aria-hidden />
    case 'failed':
      return <XCircle className={className} aria-hidden />
    case 'skipped':
      return <MinusCircle className={className} aria-hidden />
    default:
      return <CircleDashed className={className} aria-hidden />
  }
}

function stageDetail(stage: ReviewStage, review: ReviewDetail): string | null {
  if (stage.id === 'context' && stage.state === 'active') {
    return statusLabel[review.status]
  }
  if (stage.id === 'analysis' && review.progress.plannedChunks > 0 && stage.state !== 'skipped') {
    return `${review.progress.completedChunks} из ${review.progress.plannedChunks} чанков`
  }
  return null
}

export interface ReviewProgressProps {
  review: ReviewDetail
  transport: ReviewTransport
  /** Nothing will change any more; hide the live indicator. */
  settled: boolean
}

export function ReviewProgress({ review, transport, settled }: ReviewProgressProps) {
  const stages = getReviewStages({
    status: review.status,
    publicationStatus: review.publicationStatus,
    plannedChunks: review.progress.plannedChunks,
  })

  return (
    <section aria-label="Статус проверки" className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium" role="status" aria-live="polite">
          {statusLabel[review.status]}
        </p>
        {!settled && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {transport === 'stream' ? (
              <>
                <Radio className="h-3 w-3 text-diff-add-fg" aria-hidden />
                Обновляется в реальном времени
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" aria-hidden />
                Обновляется периодически
              </>
            )}
          </span>
        )}
      </div>

      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
        {stages.map((stage, index) => {
          const detail = stageDetail(stage, review)
          return (
            <li
              key={stage.id}
              className="flex min-w-0 flex-1 items-start gap-2 sm:flex-col sm:items-center sm:text-center"
              aria-current={stage.state === 'active' ? 'step' : undefined}
            >
              <div className="flex items-center sm:w-full">
                <div
                  className={cn(
                    'hidden h-0.5 flex-1 sm:block',
                    index === 0 ? 'invisible' : connectorClass(stages[index - 1]),
                  )}
                />
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                    circleClass[stage.state],
                  )}
                >
                  <StageIcon state={stage.state} />
                </span>
                <div
                  className={cn(
                    'hidden h-0.5 flex-1 sm:block',
                    index === stages.length - 1 ? 'invisible' : connectorClass(stage),
                  )}
                />
              </div>
              <div className="min-w-0 sm:mt-1.5 sm:px-2">
                <p className={cn('text-sm', stage.state === 'pending' ? 'text-muted-foreground' : 'font-medium')}>
                  {stageLabel[stage.id]}
                  <span className="sr-only">: {stateLabel[stage.state]}</span>
                </p>
                <p className="text-xs text-muted-foreground" aria-hidden={detail === null}>
                  {detail ?? stateLabel[stage.state]}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function connectorClass(stage: ReviewStage): string {
  return stage.state === 'done' || stage.state === 'partial' ? 'bg-diff-add-fg' : 'bg-border'
}
