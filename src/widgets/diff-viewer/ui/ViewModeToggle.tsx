import { Columns2, Rows3 } from 'lucide-react'
import type { ViewMode } from '@/widgets/diff-viewer/model/view-mode'
import { Button } from '@/shared/ui/button'

const OPTIONS: { mode: ViewMode; label: string; Icon: typeof Rows3 }[] = [
  { mode: 'unified', label: 'Unified', Icon: Rows3 },
  { mode: 'split', label: 'Side-by-side', Icon: Columns2 },
]

export interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div role="group" aria-label="Режим отображения diff" className="inline-flex gap-1 rounded-md border border-border p-0.5">
      {OPTIONS.map(({ mode: option, label, Icon }) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={mode === option ? 'default' : 'ghost'}
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
          className="gap-1"
        >
          <Icon aria-hidden="true" className="h-3 w-3" />
          {label}
        </Button>
      ))}
    </div>
  )
}
