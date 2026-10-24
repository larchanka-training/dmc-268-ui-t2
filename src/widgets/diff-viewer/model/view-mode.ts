export type ViewMode = 'unified' | 'split'

export const DEFAULT_VIEW_MODE: ViewMode = 'unified'

export function parseViewMode(value: string | null): ViewMode {
  return value === 'split' ? 'split' : DEFAULT_VIEW_MODE
}
