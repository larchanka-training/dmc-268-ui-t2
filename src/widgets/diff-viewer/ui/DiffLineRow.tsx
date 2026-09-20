import { Plus } from 'lucide-react'
import type { DiffLine } from '@/entities/diff'
import { cn } from '@/shared/lib/cn'
import { getLineAnchor } from '@/widgets/diff-viewer/ui/get-line-anchor'

const rowBgByType: Record<DiffLine['type'], string> = {
  added: 'bg-diff-add-bg',
  removed: 'bg-diff-del-bg',
  context: 'bg-diff-context-bg',
}

const markerByType: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  context: ' ',
}

export interface DiffLineRowProps {
  line: DiffLine
  hasThread: boolean
  onStartComment: () => void
}

export function DiffLineRow({ line, hasThread, onStartComment }: DiffLineRowProps) {
  const anchor = getLineAnchor(line)

  return (
    <div className={cn('group flex text-[13px] leading-5', rowBgByType[line.type])}>
      <div className="flex w-10 shrink-0 select-none justify-end bg-diff-gutter-bg pr-2 text-muted-foreground">
        {line.oldLineNumber ?? ''}
      </div>
      <div className="flex w-10 shrink-0 select-none justify-end bg-diff-gutter-bg pr-2 text-muted-foreground">
        {line.newLineNumber ?? ''}
      </div>
      <div className="flex w-6 shrink-0 select-none items-start justify-center bg-diff-gutter-bg">
        {anchor && (
          <button
            type="button"
            aria-label="Добавить комментарий к строке"
            onClick={onStartComment}
            className={cn(
              'invisible flex h-4 w-4 items-center justify-center rounded bg-primary text-primary-foreground group-hover:visible',
              hasThread && 'visible',
            )}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="w-4 shrink-0 select-none text-center font-mono text-muted-foreground">
        {markerByType[line.type]}
      </div>
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre px-1 font-mono">{line.content}</pre>
    </div>
  )
}
