import type { ReviewComment } from '@/entities/review-comment'
import { CommentCard } from '@/features/review-comment-card'

export interface OutOfDiffCommentsProps {
  comments: ReviewComment[]
  testId: 'out-of-diff-file' | 'out-of-diff-pr'
  /** На уровне PR показываем, к какому файлу относится замечание */
  showFilePath?: boolean
}

export function OutOfDiffComments({ comments, testId, showFilePath = false }: OutOfDiffCommentsProps) {
  return (
    <section data-testid={testId} aria-label="Замечания вне diff" className="border-t border-border bg-background p-3">
      <h3 className="mb-2 text-sm font-semibold">Замечания вне diff</h3>
      <ul className="space-y-2">
        {comments.map((comment) => (
          <li key={comment.id}>
            {showFilePath && <p className="mb-1 font-mono text-xs text-muted-foreground">{comment.filePath}</p>}
            <CommentCard comment={comment} />
          </li>
        ))}
      </ul>
    </section>
  )
}
