import { GitBranch } from 'lucide-react'
import type { PublicationStatus, PullRequest, Review, ReviewStatus } from '@/entities/pull-request'
import type { Severity } from '@/entities/review-comment'
import { SeveritySummary } from '@/widgets/pr-header/ui/SeveritySummary'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  QUEUED: 'В очереди',
  FETCHING_DIFF: 'Загрузка диффа',
  PARSING_CONTEXT: 'Сбор контекста',
  LLM_PROCESSING: 'Анализ моделью',
  COMPLETED: 'Ревью завершено',
  PARTIAL: 'Ревью частичное',
  FAILED: 'Ревью не удалось',
  SKIPPED: 'Ревью пропущено',
}

const STATUS_VARIANT: Record<ReviewStatus, 'secondary' | 'default' | 'success' | 'destructive' | 'outline'> = {
  QUEUED: 'secondary',
  FETCHING_DIFF: 'default',
  PARSING_CONTEXT: 'default',
  LLM_PROCESSING: 'default',
  COMPLETED: 'success',
  PARTIAL: 'outline',
  FAILED: 'destructive',
  SKIPPED: 'secondary',
}

const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  NOT_READY: 'Не опубликовано',
  PENDING: 'Публикуется',
  PUBLISHED: 'Опубликовано',
  PARTIAL: 'Опубликовано частично',
  FAILED: 'Публикация не удалась',
  UNKNOWN: 'Публикация: статус неизвестен',
  SKIPPED: 'Публикация пропущена',
}

const PUBLICATION_VARIANT: Record<PublicationStatus, 'secondary' | 'default' | 'success' | 'destructive' | 'outline'> =
  {
    NOT_READY: 'secondary',
    PENDING: 'default',
    PUBLISHED: 'success',
    PARTIAL: 'outline',
    FAILED: 'destructive',
    UNKNOWN: 'outline',
    SKIPPED: 'secondary',
  }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(login: string) {
  return login
    .split(/[-_.\s]/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export interface PullRequestHeaderProps {
  review: Review
  /** null — PR уже не открыт у провайдера (или GitHub недоступен) */
  pullRequest: PullRequest | null
  counts: Record<Severity, number>
  onSelectSeverity: (severity: Severity) => void
}

export function PullRequestHeader({ review, pullRequest: pr, counts, onSelectSeverity }: PullRequestHeaderProps) {
  return (
    <header className="space-y-3 border-b border-border pb-4">
      <h1 className="text-xl font-semibold">
        {pr?.title ?? 'Pull request'}{' '}
        <span data-testid="pr-number" className="font-normal text-muted-foreground">
          #{review.pullRequestNumber}
        </span>
      </h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {pr && (
          <>
            <span data-testid="pr-author" className="flex items-center gap-2">
              <Avatar data-testid="pr-author-avatar" className="h-6 w-6">
                <AvatarFallback>{initials(pr.author.login)}</AvatarFallback>
              </Avatar>
              {pr.author.login}
            </span>

            <span data-testid="pr-branches" className="flex items-center gap-1 font-mono text-xs">
              <GitBranch aria-hidden="true" className="h-3 w-3" />
              <code>{pr.sourceBranch}</code>
              {' → '}
              <code>{pr.targetBranch}</code>
            </span>
          </>
        )}

        <span className="text-muted-foreground">
          ревью запущено{' '}
          <time data-testid="review-created" dateTime={review.createdAt}>
            {formatDate(review.createdAt)}
          </time>
          {review.finishedAt && (
            <>
              , завершено{' '}
              <time data-testid="review-finished" dateTime={review.finishedAt}>
                {formatDate(review.finishedAt)}
              </time>
            </>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge data-testid="review-status" data-status={review.status} variant={STATUS_VARIANT[review.status]}>
          {STATUS_LABEL[review.status]}
        </Badge>
        <Badge
          data-testid="publication-status"
          data-status={review.publicationStatus}
          variant={PUBLICATION_VARIANT[review.publicationStatus]}
        >
          {PUBLICATION_LABEL[review.publicationStatus]}
        </Badge>
        <SeveritySummary counts={counts} onSelect={onSelectSeverity} />
      </div>

      {review.summary && (
        <p data-testid="review-summary" className="text-sm text-muted-foreground">
          {review.summary}
        </p>
      )}
    </header>
  )
}
