import { Bot, CheckCircle2 } from 'lucide-react'
import type { CommentThread as CommentThreadModel } from '@/entities/comment/model/types'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Separator } from '@/shared/ui/separator'
import { cn } from '@/shared/lib/cn'

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface CommentThreadProps {
  thread: CommentThreadModel
  className?: string
}

export function CommentThread({ thread, className }: CommentThreadProps) {
  return (
    <div className={cn('rounded-md border border-border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Строка {thread.anchorLine.lineNumber}
        </span>
        {thread.status === 'resolved' ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Resolved
          </Badge>
        ) : (
          <Badge variant="secondary">Open</Badge>
        )}
      </div>

      <div className="divide-y divide-border">
        {thread.comments.map((comment) => (
          <div key={comment.id} className="flex gap-2 px-3 py-2">
            <Avatar>
              <AvatarFallback>
                {comment.author.isAiAgent ? <Bot className="h-3 w-3" /> : initials(comment.author.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{comment.author.displayName}</span>
                {comment.author.isAiAgent && (
                  <Badge variant="outline" className="text-[10px]">
                    AI
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
            </div>
          </div>
        ))}
      </div>
      <Separator />
    </div>
  )
}
