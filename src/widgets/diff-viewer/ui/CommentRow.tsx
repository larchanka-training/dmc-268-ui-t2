import type { ReviewComment } from '@/entities/review-comment'
import { CommentCard } from '@/features/review-comment-card'

export interface CommentRowProps {
  comments: ReviewComment[]
  /** Число колонок таблицы — карточки растягиваются на всю ширину строки */
  colSpan: number
}

export function CommentRow({ comments, colSpan }: CommentRowProps) {
  return (
    <tr data-testid="comment-row">
      <td colSpan={colSpan} className="border-y border-border bg-background px-3 py-2 font-sans">
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      </td>
    </tr>
  )
}
