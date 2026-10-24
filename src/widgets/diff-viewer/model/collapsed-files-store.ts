import { create } from 'zustand'

interface CollapsedFilesState {
  collapsed: Record<string, boolean>
  toggle: (path: string) => void
  expand: (path: string) => void
}

/** Какие файлы diff свёрнуты (по пути). По умолчанию все развёрнуты. */
export const useCollapsedFilesStore = create<CollapsedFilesState>((set) => ({
  collapsed: {},
  toggle: (path) => set((state) => ({ collapsed: { ...state.collapsed, [path]: !state.collapsed[path] } })),
  expand: (path) => set((state) => ({ collapsed: { ...state.collapsed, [path]: false } })),
}))
