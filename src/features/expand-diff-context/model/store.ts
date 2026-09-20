import { create } from 'zustand'

export function contextRangeKey(filePath: string, hunkId: string, direction: 'before' | 'after') {
  return `${filePath}:${hunkId}:${direction}`
}

interface ExpandDiffContextState {
  expandedRanges: Record<string, boolean>
  isExpanded: (key: string) => boolean
  expandContext: (key: string) => void
}

export const useExpandDiffContextStore = create<ExpandDiffContextState>((set, get) => ({
  expandedRanges: {},
  isExpanded: (key) => Boolean(get().expandedRanges[key]),
  expandContext: (key) =>
    set((state) => ({
      expandedRanges: { ...state.expandedRanges, [key]: true },
    })),
}))
