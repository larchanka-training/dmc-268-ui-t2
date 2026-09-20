import { create } from 'zustand'

export interface CommentDraft {
  filePath: string
  side: 'old' | 'new'
  lineNumber: number
  text: string
}

interface AddReviewCommentState {
  draft: CommentDraft | null
  openComposer: (target: Omit<CommentDraft, 'text'>) => void
  updateDraftText: (text: string) => void
  closeComposer: () => void
}

export const useAddReviewCommentStore = create<AddReviewCommentState>((set) => ({
  draft: null,
  openComposer: (target) => set({ draft: { ...target, text: '' } }),
  updateDraftText: (text) => set((state) => (state.draft ? { draft: { ...state.draft, text } } : state)),
  closeComposer: () => set({ draft: null }),
}))
