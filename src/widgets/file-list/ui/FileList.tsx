import { MessageSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import type { DiffFile, DiffFileStatus } from '@/entities/diff'
import { cn } from '@/shared/lib/cn'

const STATUS_MARK: Record<DiffFileStatus, { letter: string; label: string; tone: string }> = {
  added: { letter: 'A', label: 'добавлен', tone: 'text-diff-add-fg' },
  deleted: { letter: 'D', label: 'удалён', tone: 'text-diff-del-fg' },
  modified: { letter: 'M', label: 'изменён', tone: 'text-muted-foreground' },
  renamed: { letter: 'R', label: 'переименован', tone: 'text-primary' },
}

export interface FileListItem {
  file: DiffFile
  commentCount: number
}

export interface FileListProps {
  items: FileListItem[]
}

export function FileList({ items }: FileListProps) {
  // Сохраняем query (?view=…) при переходе к файлу
  const { search } = useLocation()

  return (
    <nav data-testid="file-list" aria-label="Файлы PR">
      <ul className="space-y-0.5">
        {items.map(({ file, commentCount }) => {
          const mark = STATUS_MARK[file.status]
          return (
            <li key={file.path} data-testid="file-list-item" data-file-path={file.path}>
              <Link
                to={{ search, hash: `#file-${file.path}` }}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span title={mark.label} className={cn('w-4 shrink-0 text-center font-mono font-semibold', mark.tone)}>
                  <span aria-hidden="true">{mark.letter}</span>
                  <span className="sr-only">{mark.label}</span>
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
                <span data-testid="file-stat-add" className="text-diff-add-fg">
                  +{file.additions}
                </span>
                <span data-testid="file-stat-del" className="text-diff-del-fg">
                  -{file.deletions}
                </span>
                <span className="flex items-center gap-0.5 text-muted-foreground" title="Замечания">
                  <MessageSquare aria-hidden="true" className="h-3 w-3" />
                  <span data-testid="file-comment-count">{commentCount}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
