import { create } from 'zustand'

interface CommentCardState {
  expanded: Record<string, boolean>
  toggle: (id: string) => void
  expand: (id: string) => void
}

/** Какие карточки замечаний раскрыты (по id замечания). По умолчанию все свёрнуты. */
export const useCommentCardStore = create<CommentCardState>((set) => ({
  expanded: {},
  toggle: (id) => set((state) => ({ expanded: { ...state.expanded, [id]: !state.expanded[id] } })),
  expand: (id) => set((state) => ({ expanded: { ...state.expanded, [id]: true } })),
}))
