export interface CommentAuthor {
  id: string
  displayName: string
  avatarUrl?: string
  isAiAgent: boolean
}

export interface Comment {
  id: string
  author: CommentAuthor
  body: string
  createdAt: string
}

export type CommentThreadStatus = 'open' | 'resolved'

export interface CommentThread {
  id: string
  filePath: string
  anchorLine: {
    side: 'old' | 'new'
    lineNumber: number
  }
  status: CommentThreadStatus
  comments: Comment[]
}
