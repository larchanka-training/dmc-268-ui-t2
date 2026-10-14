import { GitBranch } from 'lucide-react'
import type { PullRequest, ReviewStatus, Verdict } from '@/entities/pull-request'
import type { Severity } from '@/entities/review-comment'
import { SeveritySummary } from '@/widgets/pr-header/ui/SeveritySummary'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Ожидает ревью',
  in_progress: 'Ревью в процессе',
  approved: 'Одобрен',
  changes_requested: 'Требуются изменения',
}

const STATUS_VARIANT: Record<ReviewStatus, 'secondary' | 'default' | 'success' | 'destructive'> = {
  pending: 'secondary',
  in_progress: 'default',
  approved: 'success',
  changes_requested: 'destructive',
}

const VERDICT_LABEL: Record<Verdict, string> = {
  approve: 'Одобрить',
  comment: 'Комментарий',
  request_changes: 'Запросить изменения',
}

const VERDICT_VARIANT: Record<Verdict, 'success' | 'outline' | 'destructive'> = {
  approve: 'success',
  comment: 'outline',
  request_changes: 'destructive',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export interface PullRequestHeaderProps {
  pullRequest: PullRequest
  counts: Record<Severity, number>
  onSelectSeverity: (severity: Severity) => void
}

export function PullRequestHeader({ pullRequest: pr, counts, onSelectSeverity }: PullRequestHeaderProps) {
  return (
    <header className="space-y-3 border-b border-border pb-4">
      <h1 className="text-xl font-semibold">
        {pr.title}{' '}
        <span data-testid="pr-number" className="font-normal text-muted-foreground">
          #{pr.number}
        </span>
      </h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span data-testid="pr-author" className="flex items-center gap-2">
          <Avatar data-testid="pr-author-avatar" className="h-6 w-6">
            {pr.author.avatarUrl && <AvatarImage src={pr.author.avatarUrl} alt="" />}
            <AvatarFallback>{initials(pr.author.name)}</AvatarFallback>
          </Avatar>
          {pr.author.name}
        </span>

        <span data-testid="pr-branches" className="flex items-center gap-1 font-mono text-xs">
          <GitBranch aria-hidden="true" className="h-3 w-3" />
          <code>{pr.sourceBranch}</code>
          {' → '}
          <code>{pr.targetBranch}</code>
        </span>

        <span className="text-muted-foreground">
          создан{' '}
          <time data-testid="pr-created" dateTime={pr.createdAt}>
            {formatDate(pr.createdAt)}
          </time>
          , обновлён{' '}
          <time data-testid="pr-updated" dateTime={pr.updatedAt}>
            {formatDate(pr.updatedAt)}
          </time>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge data-testid="review-status" data-status={pr.reviewStatus} variant={STATUS_VARIANT[pr.reviewStatus]}>
          {STATUS_LABEL[pr.reviewStatus]}
        </Badge>
        <span data-testid="pr-score" className="text-sm">
          Скор: <strong>{pr.score}</strong>
          <span className="text-muted-foreground">/100</span>
        </span>
        <Badge data-testid="pr-verdict" data-verdict={pr.verdict} variant={VERDICT_VARIANT[pr.verdict]}>
          {VERDICT_LABEL[pr.verdict]}
        </Badge>
        <SeveritySummary counts={counts} onSelect={onSelectSeverity} />
      </div>
    </header>
  )
}
