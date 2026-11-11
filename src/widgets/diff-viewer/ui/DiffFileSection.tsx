import { useMemo, useState } from 'react'
import { ChevronDown, FileWarning } from 'lucide-react'
import { highlightHunk, languageFromPath, type DiffFile, type DiffFileStatus } from '@/entities/diff'
import type { AnchoredComments } from '@/widgets/diff-viewer/model/anchor-comments'
import { useCollapsedFilesStore } from '@/widgets/diff-viewer/model/collapsed-files-store'
import type { ViewMode } from '@/widgets/diff-viewer/model/view-mode'
import { OutOfDiffComments } from '@/widgets/diff-viewer/ui/OutOfDiffComments'
import { SplitDiff } from '@/widgets/diff-viewer/ui/SplitDiff'
import { UnifiedDiff } from '@/widgets/diff-viewer/ui/UnifiedDiff'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/cn'

const STATUS_LABEL: Record<DiffFileStatus, string> = {
  added: 'added',
  deleted: 'deleted',
  modified: 'modified',
  renamed: 'renamed',
}

const STATUS_VARIANT: Record<DiffFileStatus, 'success' | 'destructive' | 'secondary' | 'default'> = {
  added: 'success',
  deleted: 'destructive',
  modified: 'secondary',
  renamed: 'default',
}

export interface DiffFileSectionProps {
  file: DiffFile
  anchored: AnchoredComments
  viewMode: ViewMode
  /** Chosen file with no comments: show every hunk, no gap buttons. */
  forceOpen?: boolean
  /** Changes when the level, search, or file filter changes. */
  filterKey?: string
}

export function DiffFileSection({ file, anchored, viewMode, forceOpen = false, filterKey = '' }: DiffFileSectionProps) {
  const collapsed = useCollapsedFilesStore((state) => Boolean(state.collapsed[file.path]))
  const toggle = useCollapsedFilesStore((state) => state.toggle)
  const bodyId = `file-body-${file.path}`
  const [openGapKeys, setOpenGapKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [wholeFile, setWholeFile] = useState(false)
  const [seenFilter, setSeenFilter] = useState(filterKey)
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey)
    setOpenGapKeys(new Set())
    setWholeFile(false)
  }

  const tokens = useMemo(() => {
    const language = languageFromPath(file.path)
    return file.hunks.map((hunk) => highlightHunk(hunk, language))
  }, [file])

  const outOfDiff = anchored.outOfDiffByFile.get(file.path) ?? []
  const Diff = viewMode === 'split' ? SplitDiff : UnifiedDiff

  return (
    <section
      id={`file-${file.path}`}
      data-testid="file-section"
      data-file-path={file.path}
      data-file-status={file.status}
      className="scroll-mt-16 overflow-hidden rounded-lg border border-border"
    >
      <header className="flex flex-wrap items-center gap-2 bg-muted px-3 py-2">
        <h2 className="m-0 min-w-0 flex-1 text-sm font-medium">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={() => toggle(file.path)}
            className="flex max-w-full items-center gap-2 rounded font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn('h-4 w-4 shrink-0 transition-transform', collapsed && '-rotate-90')}
            />
            <span className="truncate">{file.path}</span>
          </button>
          {file.status === 'renamed' && file.oldPath && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">переименован из {file.oldPath}</span>
          )}
        </h2>
        <Badge variant={STATUS_VARIANT[file.status]}>{STATUS_LABEL[file.status]}</Badge>
        {!forceOpen && !file.isBinary && file.hunks.length > 0 && (
          <button
            type="button"
            onClick={() => setWholeFile((open) => !open)}
            className="rounded-md border border-input px-2 py-0.5 text-xs"
          >
            {wholeFile ? 'только замечания' : 'весь файл'}
          </button>
        )}
        <span className="text-xs font-medium text-diff-add-fg">+{file.additions}</span>
        <span className="text-xs font-medium text-diff-del-fg">-{file.deletions}</span>
      </header>

      {!collapsed && (
        <div id={bodyId}>
          {file.isBinary ? (
            <p
              data-testid="binary-placeholder"
              className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"
            >
              <FileWarning aria-hidden="true" className="h-4 w-4" />
              Бинарный файл изменён — содержимое не отображается
            </p>
          ) : file.hunks.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Содержимое файла не изменилось</p>
          ) : (
            <div className="overflow-x-auto">
              <Diff
                hunks={file.hunks}
                tokens={tokens}
                byLine={anchored.byLine}
                rangeLines={anchored.rangeLines}
                openGapKeys={openGapKeys}
                onOpenGap={(key) => setOpenGapKeys((current) => new Set(current).add(key))}
                forceOpen={forceOpen || wholeFile}
              />
            </div>
          )}
          {outOfDiff.length > 0 && <OutOfDiffComments comments={outOfDiff} testId="out-of-diff-file" />}
        </div>
      )}
    </section>
  )
}
