import { ChevronDown } from 'lucide-react'
import type { ReviewComment } from '@/entities/review-comment'
import { SEVERITY_TONE, SeverityBadge } from '@/entities/review-comment'
import { useCommentCardStore } from '@/features/review-comment-card/model/store'
import { MiniMarkdown } from '@/features/review-comment-card/ui/MiniMarkdown'
import { SuggestedFix } from '@/features/review-comment-card/ui/SuggestedFix'
import { cn } from '@/shared/lib/cn'

export interface CommentCardProps {
  comment: ReviewComment
}

/** Раскрывающаяся карточка замечания AI. Свёрнута по умолчанию. */
export function CommentCard({ comment }: CommentCardProps) {
  const expanded = useCommentCardStore((state) => Boolean(state.expanded[comment.id]))
  const toggle = useCommentCardStore((state) => state.toggle)
  const regionId = `comment-region-${comment.id}`

  return (
    <article
      id={`comment-${comment.id}`}
      data-testid="comment-card"
      data-comment-id={comment.id}
      data-severity={comment.severity}
      className={cn('scroll-mt-16 rounded-md border bg-card text-card-foreground', SEVERITY_TONE[comment.severity])}
    >
      <h4 className="m-0 text-sm font-medium">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => toggle(comment.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SeverityBadge severity={comment.severity} />
          <span className="min-w-0 flex-1 truncate">{comment.title}</span>
          <span className="shrink-0 text-xs font-normal opacity-70">
            {comment.side} · {comment.line}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </h4>
      <div
        id={regionId}
        role="region"
        aria-label={comment.title}
        hidden={!expanded}
        className="space-y-2 border-t border-border bg-card px-3 py-2 text-card-foreground"
      >
        <MiniMarkdown source={comment.body} />
        {comment.suggestedFix && <SuggestedFix diff={comment.suggestedFix} filePath={comment.filePath} />}
      </div>
    </article>
  )
}
