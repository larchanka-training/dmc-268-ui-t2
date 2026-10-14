export type ReviewStatus = 'pending' | 'in_progress' | 'approved' | 'changes_requested'

export type Verdict = 'approve' | 'comment' | 'request_changes'

export interface PullRequestAuthor {
  name: string
  avatarUrl?: string
}

export interface PullRequest {
  id: string
  number: number
  title: string
  author: PullRequestAuthor
  sourceBranch: string
  targetBranch: string
  /** ISO */
  createdAt: string
  /** ISO */
  updatedAt: string
  reviewStatus: ReviewStatus
  /** 0–100 */
  score: number
  verdict: Verdict
}
